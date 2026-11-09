import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { config } from '../config';
import { getDb, schema } from '../db';
import type { Coupon, Gallery, Product } from '../db/schema';
import { today } from '../access';
import type { CouponRules, ProductData, ShippingMethod, TaxRate } from '$lib/store';

// --- Price lists ----------------------------------------------------------

export function listPriceLists() {
	const db = getDb();
	const lists = db.select().from(schema.priceLists).orderBy(asc(schema.priceLists.createdAt)).all();
	const productCounts = new Map(
		db
			.select({ id: schema.products.priceListId, count: sql<number>`count(*)` })
			.from(schema.products)
			.groupBy(schema.products.priceListId)
			.all()
			.map((r) => [r.id, r.count])
	);
	const galleries = db
		.select({ id: schema.galleries.id, name: schema.galleries.name, priceListId: schema.galleries.priceListId })
		.from(schema.galleries)
		.all();
	return lists.map((l) => ({
		...l,
		products: productCounts.get(l.id) ?? 0,
		galleries: galleries.filter((g) => g.priceListId === l.id || (!g.priceListId && l.isDefault)).map((g) => ({ id: g.id, name: g.name }))
	}));
}

export function getPriceList(id: string | null | undefined) {
	if (!id) return undefined;
	return getDb().select().from(schema.priceLists).where(eq(schema.priceLists.id, id)).get();
}

export function defaultPriceList() {
	return getDb().select().from(schema.priceLists).where(eq(schema.priceLists.isDefault, true)).get();
}

/** The price list a gallery sells from: its own, or the default. */
export function priceListFor(gallery: Pick<Gallery, 'priceListId'>) {
	return getPriceList(gallery.priceListId) ?? defaultPriceList();
}

export function createPriceList(name: string): string {
	const id = crypto.randomUUID();
	const first = !getDb().select({ id: schema.priceLists.id }).from(schema.priceLists).get();
	getDb().insert(schema.priceLists).values({ id, name, isDefault: first }).run();
	return id;
}

export function updatePriceList(id: string, values: { name?: string; minOrder?: number }) {
	getDb().update(schema.priceLists).set(values).where(eq(schema.priceLists.id, id)).run();
}

export function setDefaultPriceList(id: string) {
	const db = getDb();
	db.update(schema.priceLists).set({ isDefault: false }).run();
	db.update(schema.priceLists).set({ isDefault: true }).where(eq(schema.priceLists.id, id)).run();
}

export function duplicatePriceList(id: string, name: string): string | null {
	const list = getPriceList(id);
	if (!list) return null;
	const copy = createPriceList(name);
	updatePriceList(copy, { minOrder: list.minOrder });
	const db = getDb();
	for (const p of listProducts(id)) {
		db.insert(schema.products).values({ ...p, id: crypto.randomUUID(), priceListId: copy, createdAt: Date.now() }).run();
	}
	return copy;
}

export function deletePriceList(id: string) {
	const db = getDb();
	const list = getPriceList(id);
	db.update(schema.galleries).set({ priceListId: null }).where(eq(schema.galleries.priceListId, id)).run();
	db.delete(schema.priceLists).where(eq(schema.priceLists.id, id)).run();
	if (list?.isDefault) {
		const next = db.select().from(schema.priceLists).orderBy(asc(schema.priceLists.createdAt)).get();
		if (next) setDefaultPriceList(next.id);
	}
}

// --- Products -------------------------------------------------------------

export function listProducts(priceListId: string): Product[] {
	return getDb()
		.select()
		.from(schema.products)
		.where(eq(schema.products.priceListId, priceListId))
		.orderBy(asc(schema.products.position), asc(schema.products.createdAt))
		.all();
}

export function getProduct(id: string): Product | undefined {
	return getDb().select().from(schema.products).where(eq(schema.products.id, id)).get();
}

export function productsByIds(ids: string[]): Product[] {
	if (ids.length === 0) return [];
	return getDb().select().from(schema.products).where(inArray(schema.products.id, ids)).all();
}

export function toProductData(p: Product): ProductData {
	return {
		id: p.id,
		category: p.category,
		name: p.name,
		description: p.description,
		images: p.images.map((f) => `/store-images/${f}`),
		kind: p.kind,
		digital: p.digital ?? null,
		options: p.options,
		variants: p.variants,
		price: p.price,
		extraShipping: p.extraShipping,
		noPhoto: p.noPhoto,
		taxExempt: p.taxExempt,
		maxOne: p.maxOne,
		multiPhoto: p.multiPhoto
	};
}

export function saveProduct(id: string | null, priceListId: string, values: Omit<typeof schema.products.$inferInsert, 'id' | 'priceListId'>): string {
	const db = getDb();
	if (id && getProduct(id)) {
		db.update(schema.products).set(values).where(eq(schema.products.id, id)).run();
		return id;
	}
	const newId = crypto.randomUUID();
	const position = listProducts(priceListId).length;
	db.insert(schema.products).values({ ...values, id: newId, priceListId, position }).run();
	return newId;
}

export function deleteProduct(id: string) {
	getDb().delete(schema.products).where(eq(schema.products.id, id)).run();
}

export const productImagesDir = () => path.join(config.dataDir, 'store');

/** Product photos are stored as square-ish WebP copies, at most 1600 px. */
export async function saveProductImage(data: Buffer): Promise<string> {
	await fs.mkdir(productImagesDir(), { recursive: true });
	const name = `${crypto.randomUUID()}.webp`;
	await sharp(data).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(path.join(productImagesDir(), name));
	return name;
}

export async function removeProductImage(name: string) {
	if (!/^[\w-]+\.webp$/.test(name)) return;
	await fs.rm(path.join(productImagesDir(), name), { force: true });
}

// --- Tax and shipping -----------------------------------------------------

export function listTaxRates(): (TaxRate & { id: string })[] {
	return getDb().select().from(schema.taxRates).orderBy(asc(schema.taxRates.country)).all();
}

export function taxRateFor(country: string): TaxRate | null {
	return listTaxRates().find((r) => r.country === country) ?? null;
}

export function listShippingMethods(): ShippingMethod[] {
	return getDb().select().from(schema.shippingMethods).orderBy(asc(schema.shippingMethods.position), asc(schema.shippingMethods.name)).all();
}

// --- Coupons --------------------------------------------------------------

export function listCoupons(): Coupon[] {
	return getDb().select().from(schema.coupons).orderBy(asc(schema.coupons.createdAt)).all();
}

export function getCouponByCode(code: string): Coupon | undefined {
	const c = code.trim().toUpperCase();
	if (!c) return undefined;
	return getDb().select().from(schema.coupons).where(eq(schema.coupons.code, c)).get();
}

export type CouponState = 'active' | 'scheduled' | 'inactive';

export function couponState(c: Coupon, date = today()): CouponState {
	if (!c.active || (c.endsOn && c.endsOn < date) || (c.maxUses !== null && c.uses >= c.maxUses)) return 'inactive';
	return c.startsOn > date ? 'scheduled' : 'active';
}

/** Check a code for a gallery. Amount conditions are checked when the totals are computed. */
export function validateCoupon(code: string, galleryId: string): { coupon: Coupon; rules: CouponRules } | { error: 'unknown' | 'expired' | 'gallery' | 'used' } {
	const coupon = getCouponByCode(code);
	if (!coupon) return { error: 'unknown' };
	if (couponState(coupon) !== 'active') return { error: 'expired' };
	if (coupon.galleryIds && coupon.galleryIds.length > 0 && !coupon.galleryIds.includes(galleryId)) return { error: 'gallery' };
	if (coupon.oncePerGallery) {
		const used = getDb()
			.select({ id: schema.orders.id })
			.from(schema.orders)
			.where(and(eq(schema.orders.galleryId, galleryId), eq(schema.orders.couponCode, coupon.code), inArray(schema.orders.paymentStatus, ['paid', 'partially_refunded', 'refunded'])))
			.get();
		if (used) return { error: 'used' };
	}
	return {
		coupon,
		rules: {
			code: coupon.code,
			percent: coupon.percent,
			amountOff: coupon.amountOff,
			freeShipping: coupon.freeShipping,
			freeProductId: coupon.freeProductId,
			minAmount: coupon.minAmount,
			productIds: coupon.productIds && coupon.productIds.length ? coupon.productIds : null
		}
	};
}

/** The coupon shown as banner in galleries, if any is active. */
export function bannerCoupon(galleryId: string): Coupon | null {
	return listCoupons().find((c) => c.banner && couponState(c) === 'active' && (!c.galleryIds?.length || c.galleryIds.includes(galleryId))) ?? null;
}
