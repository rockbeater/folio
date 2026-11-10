import { bannerFor, galleryShell, gateCover, loadClientGallery, recordActivity, studioForClients, type VisitorInfo } from '$lib/server/client';
import { publicGallery } from '$lib/server/galleries';
import { getCart, priceCart, storeContext } from '$lib/server/store/cart';
import type { LayoutServerLoad } from './$types';
import { shouldTrack } from '$lib/server/visitors';

export const load: LayoutServerLoad = ({ params, cookies, locals, url }) => {
	const isAdmin = Boolean(locals.admin);
	const { gallery, state, role } = loadClientGallery(params.slug, { cookies, isAdmin });
	locals.lang = gallery.language;
	const studio = studioForClients();

	if (state !== 'open') {
		// The entry screens show the cover photo; nothing else of the gallery is sent.
		const cover = state === 'expired' ? null : gateCover(gallery);
		return {
			state,
			gallery: publicGallery(gallery),
			studio,
			sections: [],
			cover: null,
			visitor: { id: null, email: null, favorites: [], memberships: {}, lists: [], activeListId: null } as VisitorInfo,
			isAdmin: false,
			isPreview: false,
			pending: 0,
			totalPhotos: 0,
			banner: null,
			store: null,
			gateCover: cover,
			lockedCover: { placeholder: cover?.placeholder ?? null, color: cover?.color ?? null }
		};
	}

	const shell = galleryShell(gallery, cookies, role, url.searchParams.get('design'));

	// Count one visit per browser session.
	const visitCookie = `fs_${gallery.id}`;
	if (shouldTrack(locals) && !cookies.get(visitCookie)) {
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

	return { state, ...shell, studio, banner: bannerFor(gallery, Boolean(ctx)), store, gateCover: null, lockedCover: null };
};
