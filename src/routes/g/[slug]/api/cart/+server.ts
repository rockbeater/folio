import crypto from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import type { CartItem } from '$lib/server/db/schema';
import { photosByIds, shopAccess, type ViewerContext } from '$lib/server/client';
import { ensureCart, getCart, priceCart, saveCart, storeContext } from '$lib/server/store/cart';
import { centeredCrop, printAspect, priceOf, variantLabel, type Crop } from '$lib/store';
import type { RequestHandler } from './$types';

function view(gallery: Parameters<typeof priceCart>[0], role: Parameters<typeof priceCart>[1], items: CartItem[], coupon: string | null, url: URL) {
	return priceCart(gallery, role, items, coupon, {
		country: url.searchParams.get('country') ?? undefined,
		methodId: url.searchParams.get('method') ?? undefined
	});
}

/** The gallery's cart, also for people shopping from a shared favorite list (?share=). */
function access(slug: string, viewer: ViewerContext, url: URL) {
	const result = shopAccess(slug, viewer, url.searchParams.get('share'));
	if (!result) error(403);
	return result;
}

/** The priced cart; ?country= and ?method= add shipping and VAT. */
export const GET: RequestHandler = ({ params, cookies, locals, url }) => {
	const { gallery, role } = access(params.slug, { cookies, isAdmin: Boolean(locals.admin) }, url);
	const cart = getCart(cookies, gallery.id);
	const result = view(gallery, role, cart?.items ?? [], cart?.couponCode ?? null, url);
	if (!result) error(404, 'store-closed');
	return json(result);
};

function validCrop(value: unknown): Crop | null {
	if (!value || typeof value !== 'object') return null;
	const c = value as Record<string, unknown>;
	const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : NaN);
	const crop = { x: n(c.x), y: n(c.y), w: n(c.w), h: n(c.h) };
	if (Object.values(crop).some(Number.isNaN) || crop.w <= 0 || crop.h <= 0 || crop.x + crop.w > 1.001 || crop.y + crop.h > 1.001) return null;
	return crop;
}

interface Body {
	action?: unknown;
	productId?: unknown;
	variantKey?: unknown;
	photoIds?: unknown;
	quantity?: unknown;
	itemId?: unknown;
	crop?: unknown;
	code?: unknown;
}

export const POST: RequestHandler = async ({ params, cookies, locals, url, request }) => {
	const { gallery, role, canSee } = access(params.slug, { cookies, isAdmin: Boolean(locals.admin) }, url);
	const ctx = storeContext(gallery);
	if (!ctx) error(404, 'store-closed');
	const body = (await request.json().catch(() => ({}))) as Body;
	const cart = ensureCart(cookies, url, gallery.id);
	let items = [...cart.items];
	let couponCode = cart.couponCode;
	const quantity = Math.min(99, Math.max(1, Math.floor(Number(body.quantity) || 1)));

	switch (body.action) {
		case 'add': {
			const product = ctx.products.find((p) => p.id === body.productId);
			const key = typeof body.variantKey === 'string' ? body.variantKey : '';
			if (!product || !priceOf(product, key)) error(400, 'variant');
			const needsPhoto = !product.noPhoto && !(product.kind === 'digital' && product.digital?.scope === 'gallery');
			const ids = Array.isArray(body.photoIds) ? body.photoIds.filter((v): v is string => typeof v === 'string').slice(0, product.multiPhoto ? 200 : 1) : [];
			const photos = needsPhoto ? photosByIds(gallery.id, ids).filter(canSee) : [];
			if (needsPhoto && photos.length === 0) error(400, 'photo');
			const aspect = product.kind === 'physical' ? printAspect(variantLabel(product, key)) : null;
			const add = (photoId: string | null, crop: Crop | null) => {
				if (product.maxOne) items = items.filter((i) => i.productId !== product.id);
				const same = items.find((i) => i.productId === product.id && i.variantKey === key && i.photoId === photoId);
				if (same && !product.maxOne && product.kind === 'physical') same.quantity = Math.min(99, same.quantity + quantity);
				// A suggested crop must still be looked at and saved by the buyer before ordering.
				else if (!same) items.push({ id: crypto.randomUUID(), productId: product.id, variantKey: key, photoId, quantity: product.kind === 'physical' && !product.maxOne ? quantity : 1, crop, cropConfirmed: false });
			};
			if (needsPhoto) {
				for (const photo of photos) {
					const crop = aspect ? centeredCrop(photo.width || 3, photo.height || 2, aspect) : null;
					add(photo.id, crop && crop.w === 1 && crop.h === 1 ? null : crop);
				}
			} else add(null, null);
			break;
		}
		case 'update': {
			const item = items.find((i) => i.id === body.itemId);
			if (!item) error(404);
			if (body.quantity !== undefined) item.quantity = quantity;
			if (body.crop !== undefined) {
				const crop = validCrop(body.crop);
				if (crop) {
					item.crop = crop;
					item.cropConfirmed = true;
				}
			}
			break;
		}
		case 'remove':
			items = items.filter((i) => i.id !== body.itemId);
			break;
		case 'coupon':
			couponCode = typeof body.code === 'string' && body.code.trim() ? body.code.trim().toUpperCase().slice(0, 40) : null;
			break;
		default:
			error(400);
	}

	saveCart(cart.id, { items, couponCode });
	return json(view(gallery, role, items, couponCode, url));
};
