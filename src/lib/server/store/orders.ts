import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import sharp from 'sharp';
import yazl from 'yazl';
import { randomToken } from '../crypto';
import { getDb, schema } from '../db';
import type { Gallery, Order, OrderAddress, OrderItem } from '../db/schema';
import { photoFilter } from '../client';
import { getGalleryById, getPhotosBySection, getSections } from '../galleries';
import { originalFile } from '../images/paths';
import { queueNotice, queueStoreEmail } from '../mail/send';
import { createI18n } from '$lib/i18n';
import { getStore, saveStore } from '../settings';
import type { DownloadItem } from '../download';
import { priceCart, type CartView } from './cart';
import { createCheckoutSession, createRefund } from './stripe';
import { formatMoney, type Crop } from '$lib/store';
import type { Role } from '$lib/types';
import type { CartItem } from '../db/schema';

export interface CheckoutInput {
	email: string;
	name: string;
	phone: string;
	country: string;
	address: OrderAddress | null;
	methodId: string;
	acceptTerms: boolean;
	acceptLicense: boolean;
}

export type CheckoutError =
	| 'empty'
	| 'minimum'
	| 'email'
	| 'name'
	| 'country'
	| 'method'
	| 'address'
	| 'terms'
	| 'license'
	| 'coupon'
	| 'payments'
	| 'stripe';

function nextOrderNumber(): number {
	const row = getDb().select({ max: sql<number | null>`max(${schema.orders.number})` }).from(schema.orders).get();
	return Math.max(1000, row?.max ?? 1000) + 1;
}

export function getOrder(id: string): Order | undefined {
	return getDb().select().from(schema.orders).where(eq(schema.orders.id, id)).get();
}

export function getOrderByToken(token: string): Order | undefined {
	if (!token || token.length < 20) return undefined;
	return getDb().select().from(schema.orders).where(eq(schema.orders.token, token)).get();
}

export function orderItems(orderId: string): OrderItem[] {
	return getDb().select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId)).all();
}

function touch(id: string, values: Partial<Order>) {
	getDb().update(schema.orders).set({ ...values, updatedAt: Date.now() }).where(eq(schema.orders.id, id)).run();
}

/** Validate the checkout form against the priced cart. */
function checkInput(view: CartView, input: CheckoutInput, needsLicense: boolean): CheckoutError | null {
	const store = getStore();
	if (view.lines.length === 0) return 'empty';
	if (view.belowMinimum) return 'minimum';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return 'email';
	if (!input.name) return 'name';
	if (!/^[A-Z]{2}$/.test(input.country)) return 'country';
	if (view.couponCode && view.couponError) return 'coupon';
	if (view.totals.needsShipping) {
		const method = view.methods.find((m) => m.id === input.methodId);
		if (!method) return 'method';
		if (!method.pickup && (!input.address?.line1 || !input.address.postalCode || !input.address.city)) return 'address';
	}
	if (store.terms.trim() && !input.acceptTerms) return 'terms';
	if (needsLicense && store.license.trim() && !input.acceptLicense) return 'license';
	return null;
}

/**
 * Create the order from the cart and start the payment. Returns where to send the buyer:
 * Stripe Checkout, the payment simulator, or the receipt for orders that cost nothing.
 */
export async function placeOrder(
	gallery: Gallery,
	role: Role,
	cart: { items: CartItem[]; couponCode: string | null },
	input: CheckoutInput,
	baseUrl: string,
	simulator: boolean
): Promise<{ redirect: string } | { error: CheckoutError; message?: string }> {
	const view = priceCart(gallery, role, cart.items, cart.couponCode, { country: input.country, methodId: input.methodId });
	if (!view) return { error: 'empty' };
	const error = checkInput(view, input, view.lines.some((l) => l.kind === 'digital'));
	if (error) return { error };

	if (getStore().siteUrl !== baseUrl) saveStore({ siteUrl: baseUrl });
	const store = getStore();
	const method = view.totals.needsShipping ? view.methods.find((m) => m.id === input.methodId)! : null;
	const db = getDb();
	const id = crypto.randomUUID();
	const token = randomToken(24);
	const sections = new Map(getSections(gallery.id).map((s) => [s.id, s]));
	const items = new Map(cart.items.map((i) => [i.id, i]));
	const viewLines = new Map(view.lines.map((l) => [l.id, l]));
	const { totals } = view;

	db.transaction((tx) => {
		tx.insert(schema.orders)
			.values({
				id,
				number: nextOrderNumber(),
				token,
				galleryId: gallery.id,
				galleryName: gallery.name,
				buyerRole: role === 'guest' ? 'guest' : 'client',
				email: input.email.toLowerCase(),
				name: input.name,
				phone: input.phone,
				country: input.country,
				address: totals.needsShipping && method && !method.pickup ? input.address : null,
				shippingName: method?.name ?? null,
				currency: store.currency,
				language: gallery.language,
				kind: totals.kind === 'none' ? 'digital' : totals.kind,
				subtotal: totals.subtotal,
				discount: totals.discount,
				shipping: totals.shipping,
				tax: totals.tax,
				total: totals.total,
				couponCode: view.couponCode && !view.couponError ? view.couponCode.toUpperCase() : null
			})
			.run();
		for (const line of totals.lines) {
			const viewLine = viewLines.get(line.id)!;
			const item = items.get(line.id)!;
			const photo = viewLine.photo;
			const digital = viewLine.kind === 'digital';
			tx.insert(schema.orderItems)
				.values({
					id: crypto.randomUUID(),
					orderId: id,
					productId: viewLine.productId,
					productName: viewLine.productName,
					variantLabel: viewLine.label,
					kind: viewLine.kind,
					digital: digital ? (productDigital(gallery, viewLine.productId) ?? null) : null,
					photoId: photo?.id ?? null,
					filename: photo?.filename ?? null,
					sectionId: photo?.sectionId && sections.has(photo.sectionId) ? photo.sectionId : null,
					crop: item.crop,
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					discount: line.discount,
					taxRate: line.taxRate,
					tax: line.tax
				})
				.run();
		}
	});

	if (totals.total === 0) {
		markPaid(id, null, 'free');
		return { redirect: `/order/${token}` };
	}

	const success = `${baseUrl}/order/${token}`;
	if (store.stripe.secretKey) {
		try {
			const discounted = totals.discount > 0;
			// With a discount the order is sent as one line with the final amount, so Stripe charges exactly the total.
			const lines = discounted
				? [{ name: createI18n(gallery.language).t('store.orderNumber', { number: String(getOrder(id)!.number) }), amount: totals.total, quantity: 1 }]
				: totals.lines.map((l) => {
						const v = viewLines.get(l.id)!;
						return { name: [v.productName, v.label, v.photo?.filename].filter(Boolean).join(' · '), amount: l.unitPrice, quantity: l.quantity };
					});
			const session = await createCheckoutSession({
				orderId: id,
				email: input.email,
				currency: store.currency,
				lines,
				shipping: !discounted && totals.shipping > 0 && method ? { name: method.name, amount: totals.shipping } : null,
				successUrl: success,
				cancelUrl: `${baseUrl}/g/${gallery.slug}/cart`,
				locale: gallery.language === 'da' ? 'da' : 'auto'
			});
			touch(id, { stripeSessionId: session.id, stripeMode: store.stripe.mode ?? 'test' });
			return { redirect: session.url };
		} catch (err) {
			touch(id, { status: 'cancelled', notes: `Stripe: ${(err as Error).message}` });
			return { error: 'stripe', message: (err as Error).message };
		}
	}
	if (simulator) {
		touch(id, { stripeSessionId: `cs_sim_${randomToken(12)}`, stripeMode: 'simulated' });
		return { redirect: `/store/simulate/${token}` };
	}
	touch(id, { status: 'cancelled' });
	return { error: 'payments' };
}

function productDigital(gallery: Gallery, productId: string) {
	const row = getDb().select({ digital: schema.products.digital }).from(schema.products).where(eq(schema.products.id, productId)).get();
	return row?.digital ?? null;
}

/** Payment confirmed (webhook, simulator or a free order). Safe to call more than once. */
export function markPaid(orderId: string, paymentIntent: string | null, mode?: Order['stripeMode']): void {
	const order = getOrder(orderId);
	if (!order || order.paymentStatus === 'paid' || order.paymentStatus === 'refunded' || order.paymentStatus === 'partially_refunded') return;
	touch(order.id, {
		paymentStatus: 'paid',
		status: order.kind === 'digital' ? 'completed' : 'processing',
		paidAt: Date.now(),
		stripePaymentIntent: paymentIntent ?? order.stripePaymentIntent,
		...(mode ? { stripeMode: mode } : {})
	});
	if (order.couponCode) {
		getDb()
			.update(schema.coupons)
			.set({ uses: sql`${schema.coupons.uses} + 1` })
			.where(eq(schema.coupons.code, order.couponCode))
			.run();
	}
	const paid = getOrder(order.id)!;
	queueStoreEmail(paid, 'order');
	if (paid.kind !== 'physical') queueStoreEmail(paid, 'digital');
	notifyPhotographer(paid);
}

function notifyPhotographer(order: Order) {
	const store = getStore();
	const { t } = createI18n(order.language);
	queueNotice(
		order.galleryId,
		store.email,
		t('email.newOrder.subject', { number: String(order.number) }),
		t('email.newOrder.body', {
			number: String(order.number),
			name: order.name,
			email: order.email,
			total: formatMoney(order.total, order.currency, order.language),
			gallery: order.galleryName
		})
	);
}

export function markFailed(orderId: string): void {
	const order = getOrder(orderId);
	if (!order || order.paymentStatus !== 'unpaid') return;
	touch(order.id, { paymentStatus: 'failed', status: 'cancelled' });
}

export function markExpired(orderId: string): void {
	const order = getOrder(orderId);
	if (order && order.paymentStatus === 'unpaid') touch(order.id, { status: 'cancelled' });
}

/** Record a refund (from admin or from a charge.refunded webhook). */
export function recordRefund(order: Order, totalRefunded: number, notify: boolean): void {
	const refunded = Math.min(order.total, Math.max(order.refunded, totalRefunded));
	const full = refunded >= order.total;
	touch(order.id, {
		refunded,
		paymentStatus: full ? 'refunded' : 'partially_refunded',
		status: full ? 'refunded' : order.status
	});
	if (notify && refunded > order.refunded) queueStoreEmail(getOrder(order.id)!, 'refunded', refunded - order.refunded);
}

export async function refundOrder(order: Order, amount: number): Promise<{ ok: true } | { ok: false; error: string }> {
	const left = order.total - order.refunded;
	const value = Math.min(left, Math.max(1, Math.floor(amount)));
	if (left <= 0 || !['paid', 'partially_refunded'].includes(order.paymentStatus)) return { ok: false, error: 'not-refundable' };
	if (order.stripeMode === 'test' || order.stripeMode === 'live') {
		if (!order.stripePaymentIntent) return { ok: false, error: 'no-payment' };
		try {
			await createRefund(order.stripePaymentIntent, value);
		} catch (err) {
			return { ok: false, error: (err as Error).message };
		}
	}
	recordRefund(order, order.refunded + value, true);
	return { ok: true };
}

export function shipOrder(order: Order, tracking: string): void {
	touch(order.id, { status: 'shipped', tracking: tracking || null });
	queueStoreEmail(getOrder(order.id)!, 'shipped');
}

export function updateOrder(order: Order, values: Partial<Pick<Order, 'status' | 'notes'>>): void {
	touch(order.id, values);
}

/** Handle a verified Stripe event. Unknown events are ignored. */
export function handleStripeEvent(event: { type: string; data: { object: Record<string, unknown> } }): void {
	saveStore({ stripe: { lastWebhookAt: Date.now() } });
	const obj = event.data.object;
	const orderId = (obj.client_reference_id as string) || ((obj.metadata as Record<string, string> | undefined)?.order_id ?? '');
	switch (event.type) {
		case 'checkout.session.completed':
			if (obj.payment_status === 'paid' || obj.payment_status === 'no_payment_required') markPaid(orderId, (obj.payment_intent as string) ?? null);
			break;
		case 'checkout.session.async_payment_succeeded':
			markPaid(orderId, (obj.payment_intent as string) ?? null);
			break;
		case 'checkout.session.async_payment_failed':
			markFailed(orderId);
			break;
		case 'checkout.session.expired':
			markExpired(orderId);
			break;
		case 'charge.refunded': {
			const intent = obj.payment_intent as string;
			const order = intent ? getDb().select().from(schema.orders).where(eq(schema.orders.stripePaymentIntent, intent)).get() : undefined;
			if (order) recordRefund(order, Number(obj.amount_refunded) || 0, true);
			break;
		}
	}
}

// --- Lists for the admin --------------------------------------------------

export interface OrderFilter {
	number?: string;
	status?: string;
	customer?: string;
	gallery?: string;
	kind?: string;
	page?: number;
}

export const PAGE_SIZE = 25;

export function listOrders(filter: OrderFilter = {}) {
	const all = getDb().select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).all();
	const q = (v?: string) => (v ?? '').trim().toLowerCase();
	const rows = all.filter(
		(o) =>
			(!q(filter.number) || String(o.number).includes(q(filter.number))) &&
			(!filter.status || o.status === filter.status) &&
			(!q(filter.customer) || o.email.includes(q(filter.customer)) || o.name.toLowerCase().includes(q(filter.customer))) &&
			(!q(filter.gallery) || o.galleryName.toLowerCase().includes(q(filter.gallery))) &&
			(!filter.kind || o.kind === filter.kind)
	);
	const page = Math.max(1, filter.page ?? 1);
	return { total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), all: rows };
}

export function ordersForGallery(galleryId: string) {
	return getDb().select().from(schema.orders).where(eq(schema.orders.galleryId, galleryId)).orderBy(desc(schema.orders.createdAt)).all();
}

/** Customers derived from paid orders, grouped by email. */
export function listCustomers() {
	const orders = getDb()
		.select()
		.from(schema.orders)
		.where(inArray(schema.orders.paymentStatus, ['paid', 'partially_refunded', 'refunded']))
		.orderBy(desc(schema.orders.createdAt))
		.all();
	const map = new Map<string, { email: string; name: string; orders: number; spent: number; currency: string; lastOrder: number }>();
	for (const o of orders) {
		const c = map.get(o.email) ?? { email: o.email, name: o.name, orders: 0, spent: 0, currency: o.currency, lastOrder: o.createdAt };
		c.orders += 1;
		c.spent += o.total - o.refunded;
		c.lastOrder = Math.max(c.lastOrder, o.createdAt);
		map.set(o.email, c);
	}
	return [...map.values()];
}

/** Photos in orders that are not finished yet (to warn before deleting them). */
export function photosInOpenOrders(photoIds: string[]): string[] {
	if (photoIds.length === 0) return [];
	return getDb()
		.select({ photoId: schema.orderItems.photoId })
		.from(schema.orderItems)
		.innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
		.where(and(inArray(schema.orderItems.photoId, photoIds), inArray(schema.orders.status, ['pending', 'processing'])))
		.all()
		.map((r) => r.photoId!)
		.filter(Boolean);
}

/** VAT report: revenue and VAT per month (paid orders, minus refunds). */
export function vatReport(from: string, to: string) {
	const orders = getDb()
		.select()
		.from(schema.orders)
		.where(inArray(schema.orders.paymentStatus, ['paid', 'partially_refunded', 'refunded']))
		.all()
		.filter((o) => {
			const day = new Date(o.paidAt ?? o.createdAt).toLocaleDateString('sv-SE');
			return (!from || day >= from) && (!to || day <= to);
		});
	const months = new Map<string, { month: string; orders: number; revenue: number; tax: number; refunded: number }>();
	for (const o of orders) {
		const month = new Date(o.paidAt ?? o.createdAt).toLocaleDateString('sv-SE').slice(0, 7);
		const m = months.get(month) ?? { month, orders: 0, revenue: 0, tax: 0, refunded: 0 };
		const share = o.total > 0 ? (o.total - o.refunded) / o.total : 0;
		m.orders += 1;
		m.revenue += o.total - o.refunded;
		m.tax += Math.round(o.tax * share);
		m.refunded += o.refunded;
		months.set(month, m);
	}
	return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// --- Files -------------------------------------------------------------------

/** The photos a digital order line gives access to. */
export function digitalItems(order: Order, item: OrderItem): DownloadItem[] {
	const gallery = order.galleryId ? getGalleryById(order.galleryId) : undefined;
	if (!gallery || item.kind !== 'digital' || !item.digital) return [];
	const canSee = photoFilter(gallery, order.buyerRole === 'client' ? 'client' : 'guest');
	const sections = getSections(gallery.id);
	const bySection = getPhotosBySection(gallery.id);
	const all = sections.flatMap((section) => (bySection.get(section.id) ?? []).filter(canSee).map((photo) => ({ photo, section })));
	if (item.digital.scope === 'gallery') return all;
	if (item.digital.scope === 'section') return all.filter((i) => i.section.id === item.sectionId);
	return all.filter((i) => i.photo.id === item.photoId);
}

function safe(value: string): string {
	return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

/** All physical items as one ZIP for the lab: "<n>-<product>-<size>-<qty>x-<file>", crops applied. */
export function printZip(order: Order): Response | null {
	const gallery = order.galleryId ? getGalleryById(order.galleryId) : undefined;
	if (!gallery) return null;
	const sections = new Map(getSections(gallery.id).map((s) => [s.id, s]));
	const photos = new Map([...getPhotosBySection(gallery.id).values()].flat().map((p) => [p.id, p]));
	const items = orderItems(order.id).filter((i) => i.kind === 'physical' && i.photoId && photos.has(i.photoId));
	if (items.length === 0) return null;
	const zip = new yazl.ZipFile();
	items.forEach((item, index) => {
		const photo = photos.get(item.photoId!)!;
		const section = sections.get(photo.sectionId);
		if (!section) return;
		const ext = path.extname(photo.filename) || '.jpg';
		const name = safe(
			[String(index + 1).padStart(2, '0'), item.productName, item.variantLabel, `${item.quantity}x`, photo.filename.slice(0, photo.filename.length - ext.length)]
				.filter(Boolean)
				.join('-')
		);
		const file = originalFile(gallery.folder, section.folder, photo.filename);
		zip.addReadStreamLazy(`${name}${item.crop ? '.jpg' : ext}`, { compress: false }, (cb) => {
			if (!item.crop) return cb(null, fs.createReadStream(file));
			cropped(file, item.crop)
				.then((buffer) => cb(null, Readable.from(buffer)))
				.catch((err: Error) => cb(err, undefined as unknown as Readable));
		});
	});
	zip.end();
	return new Response(Readable.toWeb(zip.outputStream as Readable) as ReadableStream, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="order-${order.number}-print.zip"`,
			'cache-control': 'private, no-store'
		}
	});
}

/** One order line's photo for the lab: the original, or a JPEG with the buyer's crop applied. */
export async function printFile(order: Order, itemId: string): Promise<Response | null> {
	const item = orderItems(order.id).find((i) => i.id === itemId);
	const gallery = order.galleryId ? getGalleryById(order.galleryId) : undefined;
	if (!item?.photoId || !gallery) return null;
	const photo = [...getPhotosBySection(gallery.id).values()].flat().find((p) => p.id === item.photoId);
	const section = photo ? getSections(gallery.id).find((s) => s.id === photo.sectionId) : undefined;
	if (!photo || !section) return null;
	const file = originalFile(gallery.folder, section.folder, photo.filename);
	const ext = path.extname(photo.filename) || '.jpg';
	const base = safe([`order-${order.number}`, item.productName, item.variantLabel, `${item.quantity}x`, photo.filename.slice(0, photo.filename.length - ext.length)].filter(Boolean).join('-'));
	const data = item.crop ? await cropped(file, item.crop) : await fs.promises.readFile(file);
	const name = `${base}${item.crop ? '.jpg' : ext}`;
	return new Response(new Uint8Array(data), {
		headers: {
			'content-type': item.crop || /\.jpe?g$/i.test(ext) ? 'image/jpeg' : 'application/octet-stream',
			'content-disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
			'cache-control': 'private, no-store'
		}
	});
}

async function cropped(file: string, crop: Crop): Promise<Buffer> {
	const image = sharp(file).rotate();
	const { data, info } = await image.toBuffer({ resolveWithObject: true });
	const left = Math.round(crop.x * info.width);
	const top = Math.round(crop.y * info.height);
	const width = Math.min(info.width - left, Math.round(crop.w * info.width));
	const height = Math.min(info.height - top, Math.round(crop.h * info.height));
	return sharp(data).extract({ left, top, width, height }).jpeg({ quality: 95, mozjpeg: true }).toBuffer();
}

