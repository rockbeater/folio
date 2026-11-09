import { eq } from 'drizzle-orm';
import { bannerFor, galleryShell, loadClientGallery, recordActivity, studioForClients, type VisitorInfo } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import { publicGallery } from '$lib/server/galleries';
import { getCart, priceCart, storeContext } from '$lib/server/store/cart';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params, cookies, locals, url }) => {
	const isAdmin = Boolean(locals.admin);
	const { gallery, state, role } = loadClientGallery(params.slug, { cookies, isAdmin });
	locals.lang = gallery.language;
	const studio = studioForClients();

	if (state !== 'open') {
		// Before the gallery opens, only a tiny blurred placeholder of the cover is shown.
		const cover = gallery.coverPhotoId
			? getDb()
					.select({ placeholder: schema.photos.placeholder, color: schema.photos.color })
					.from(schema.photos)
					.where(eq(schema.photos.id, gallery.coverPhotoId))
					.get()
			: undefined;
		return {
			state,
			gallery: publicGallery(gallery),
			studio,
			sections: [],
			cover: null,
			visitor: { id: null, email: null, favorites: [], lists: [], activeListId: null } as VisitorInfo,
			isAdmin: false,
			isPreview: false,
			pending: 0,
			totalPhotos: 0,
			banner: null,
			store: null,
			lockedCover: { placeholder: cover?.placeholder ?? null, color: cover?.color ?? null }
		};
	}

	const shell = galleryShell(gallery, cookies, role, url.searchParams.get('design'));

	// Count one visit per browser session.
	const visitCookie = `fs_${gallery.id}`;
	if (!isAdmin && !cookies.get(visitCookie)) {
		recordActivity(gallery.id, 'visit', shell.visitor.email);
		cookies.set(visitCookie, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
	}

	const ctx = storeContext(gallery);
	const cart = ctx ? getCart(cookies, gallery.id) : null;
	const store = ctx
		? {
				currency: ctx.store.currency,
				products: ctx.products,
				cartCount: cart ? (priceCart(gallery, role, cart.items, cart.couponCode)?.count ?? 0) : 0
			}
		: null;

	return { state, ...shell, studio, banner: bannerFor(gallery, Boolean(ctx)), store, lockedCover: null };
};
