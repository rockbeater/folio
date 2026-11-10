import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { readSignedValue, signedValue } from '../crypto';
import { getDb, schema } from '../db';
import type { CartItem, Gallery, Photo } from '../db/schema';
import { galleryWatermarkKey, photoFilter, photosByIds } from '../client';
import { toPhotoView } from '../galleries';
import { getStore } from '../settings';
import { listProducts, listShippingMethods, priceListFor, taxRateFor, toProductData, validateCoupon } from './catalog';
import {
	computeTotals,
	isBuyable,
	methodsFor,
	printAspect,
	priceOf,
	variantLabel,
	type Crop,
	type ProductData,
	type ShippingMethod,
	type Totals
} from '$lib/store';
import type { PhotoView, Role } from '$lib/types';

const DAY = 24 * 60 * 60;
const cookieName = (galleryId: string) => `fk_${galleryId}`;

/** The store of a gallery, if it is open: the global switch, the gallery's switch and a price list with products. */
export function storeContext(gallery: Gallery) {
	const store = getStore();
	if (!store.enabled || !gallery.storeEnabled) return null;
	const priceList = priceListFor(gallery);
	if (!priceList) return null;
	const products = listProducts(priceList.id).map(toProductData).filter(isBuyable);
	if (products.length === 0) return null;
	return { store, priceList, products };
}

export function getCart(cookies: Cookies, galleryId: string) {
	const id = readSignedValue(cookies.get(cookieName(galleryId)));
	if (!id) return null;
	const cart = getDb().select().from(schema.carts).where(eq(schema.carts.id, id)).get();
	return cart && cart.galleryId === galleryId ? cart : null;
}

export function ensureCart(cookies: Cookies, url: URL, galleryId: string) {
	const existing = getCart(cookies, galleryId);
	if (existing) return existing;
	const id = crypto.randomUUID();
	getDb().insert(schema.carts).values({ id, galleryId, items: [] }).run();
	cookies.set(cookieName(galleryId), signedValue(id), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 90 * DAY
	});
	return getDb().select().from(schema.carts).where(eq(schema.carts.id, id)).get()!;
}

export function saveCart(cartId: string, values: { items?: CartItem[]; couponCode?: string | null }) {
	getDb().update(schema.carts).set({ ...values, updatedAt: Date.now() }).where(eq(schema.carts.id, cartId)).run();
}

export function clearCart(cookies: Cookies, galleryId: string) {
	const cart = getCart(cookies, galleryId);
	if (cart) saveCart(cart.id, { items: [], couponCode: null });
}

export interface CartLineView {
	id: string;
	productId: string;
	productName: string;
	variantKey: string;
	label: string;
	kind: ProductData['kind'];
	photo: PhotoView | null;
	quantity: number;
	maxOne: boolean;
	unitPrice: number;
	gross: number;
	discount: number;
	crop: Crop | null;
	/** Print aspect ratio, when the variant names a print size (for the crop tool). */
	aspect: number | null;
	/** The photo does not fit the print, and the buyer has not chosen the crop yet. */
	cropNeeded: boolean;
}

export interface CartView {
	currency: string;
	lines: CartLineView[];
	totals: Totals;
	couponCode: string | null;
	couponError: string | null;
	minOrder: number;
	belowMinimum: boolean;
	countries: string[];
	methods: ShippingMethod[];
	count: number;
	/** Lines where the buyer still has to choose the crop. */
	cropsMissing: number;
}

/** Whether a product line needs a photo, and whether the photo may be bought by this role. */
function lineIsValid(product: ProductData, item: CartItem, photo: Photo | undefined, canSee: (p: Photo) => boolean): boolean {
	if (!priceOf(product, item.variantKey)) return false;
	const needsPhoto = !product.noPhoto && !(product.kind === 'digital' && product.digital?.scope === 'gallery');
	if (!needsPhoto) return true;
	return Boolean(photo && canSee(photo));
}

/** Price a cart for a gallery and role. Invalid lines (removed products, hidden variants, photos the role may not see) are left out. */
export function priceCart(
	gallery: Gallery,
	role: Role,
	items: CartItem[],
	couponCode: string | null,
	opts: { country?: string; methodId?: string } = {}
): CartView | null {
	const ctx = storeContext(gallery);
	if (!ctx) return null;
	const byId = new Map(ctx.products.map((p) => [p.id, p]));
	const photos = new Map(photosByIds(gallery.id, items.map((i) => i.photoId).filter((id): id is string => Boolean(id))).map((p) => [p.id, p]));
	const canSee = photoFilter(gallery, role);
	const wmKey = galleryWatermarkKey(gallery);

	const valid = items.filter((i) => {
		const product = byId.get(i.productId);
		return product && lineIsValid(product, i, i.photoId ? photos.get(i.photoId) : undefined, canSee);
	});

	let couponError: string | null = null;
	let rules = null;
	if (couponCode) {
		const result = validateCoupon(couponCode, gallery.id);
		if ('error' in result) couponError = result.error;
		else rules = result.rules;
	}

	const methods = listShippingMethods();
	const country = opts.country ?? '';
	const available = country ? methodsFor(methods, country) : [];
	const method = available.find((m) => m.id === opts.methodId) ?? null;

	const totals = computeTotals({
		lines: valid.map((i) => ({ id: i.id, product: byId.get(i.productId)!, variantKey: i.variantKey, quantity: byId.get(i.productId)!.maxOne ? 1 : i.quantity })),
		coupon: rules,
		method,
		rate: country ? taxRateFor(country) : null
	});
	if (totals.couponProblem) couponError = totals.couponProblem;

	const lines = valid.map((i) => {
		const product = byId.get(i.productId)!;
		const priced = totals.lines.find((l) => l.id === i.id)!;
		const photo = i.photoId ? photos.get(i.photoId) : undefined;
		const label = variantLabel(product, i.variantKey);
		return {
			id: i.id,
			productId: product.id,
			productName: product.name,
			variantKey: i.variantKey,
			label,
			kind: product.kind,
			photo: photo ? toPhotoView(photo, wmKey) : null,
			quantity: priced.quantity,
			maxOne: product.maxOne,
			unitPrice: priced.unitPrice,
			gross: priced.gross,
			discount: priced.discount,
			crop: i.crop,
			aspect: product.kind === 'physical' && photo ? printAspect(label) : null,
			cropNeeded: Boolean(i.crop && !i.cropConfirmed)
		};
	});

	const countries = [...new Set(methods.map((m) => m.country).filter((c) => c !== '*'))];
	return {
		currency: ctx.store.currency,
		lines,
		totals,
		couponCode: couponCode ?? null,
		couponError,
		minOrder: ctx.priceList.minOrder,
		belowMinimum: ctx.priceList.minOrder > 0 && totals.subtotal < ctx.priceList.minOrder,
		countries,
		methods: available,
		count: lines.reduce((sum, l) => sum + l.quantity, 0),
		cropsMissing: lines.filter((l) => l.cropNeeded).length
	};
}
