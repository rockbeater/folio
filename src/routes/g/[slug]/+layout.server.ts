import { bannerFor, galleryShell, gateCover, loadClientGallery, recordActivity, sharedListName, shopAccess, studioForClients, type VisitorInfo } from '$lib/server/client';
import { publicGallery } from '$lib/server/galleries';
import { getCart, priceCart, storeContext } from '$lib/server/store/cart';
import type { LayoutServerLoad } from './$types';
import { shouldTrack } from '$lib/server/visitors';

const noVisitor: VisitorInfo = { id: null, email: null, favorites: [], memberships: {}, lists: [], activeListId: null };

export const load: LayoutServerLoad = ({ params, cookies, locals, url, route }) => {
	const isAdmin = Boolean(locals.admin);
	const { gallery, state, role } = loadClientGallery(params.slug, { cookies, isAdmin });
	locals.lang = gallery.language;
	const studio = studioForClients();

	// Someone a favorite list was shared with may use the cart without seeing the gallery.
	const share = route.id === '/g/[slug]/cart' ? url.searchParams.get('share') : null;
	const shop = state !== 'open' && share ? shopAccess(params.slug, { cookies, isAdmin }, share) : null;
	const shopCtx = shop?.list ? storeContext(gallery) : null;
	if (shop?.list && shopCtx) {
		const cart = getCart(cookies, gallery.id);
		return {
			state: 'shop' as const,
			gallery: publicGallery(gallery, 'guest'),
			studio,
			sections: [],
			cover: null,
			visitor: noVisitor,
			isAdmin: false,
			isPreview: false,
			pending: 0,
			totalPhotos: 0,
			banner: null,
			store: {
				currency: shopCtx.store.currency,
				products: shopCtx.products,
				cartCount: cart ? (priceCart(gallery, 'guest', cart.items, cart.couponCode)?.count ?? 0) : 0
			},
			shared: { token: share!, name: sharedListName(gallery, shop.list) },
			gateCover: null,
			lockedCover: null
		};
	}

	if (state !== 'open') {
		// The entry screens show the cover photo; nothing else of the gallery is sent.
		const cover = state === 'expired' ? null : gateCover(gallery);
		return {
			state,
			gallery: publicGallery(gallery),
			studio,
			sections: [],
			cover: null,
			visitor: noVisitor,
			isAdmin: false,
			isPreview: false,
			pending: 0,
			totalPhotos: 0,
			banner: null,
			store: null,
			shared: null,
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

	return { state, ...shell, studio, banner: bannerFor(gallery, Boolean(ctx)), store, shared: null, gateCover: null, lockedCover: null };
};
