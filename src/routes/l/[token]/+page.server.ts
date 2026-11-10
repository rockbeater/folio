import { error } from '@sveltejs/kit';
import { addShareGrant } from '$lib/server/access';
import { isListLocked, photosInOrder, sharedListFor, sharedListName, studioForClients } from '$lib/server/client';
import { getGalleryById, publicGallery } from '$lib/server/galleries';
import { countShare, getListByToken, listPhotoIds } from '$lib/server/lists';
import { getCart, priceCart, storeContext } from '$lib/server/store/cart';
import type { PageServerLoad } from './$types';
import { shouldTrack } from '$lib/server/visitors';

/**
 * A shared favorite list. Private shares show only the list (no gallery password needed);
 * open shares lead on to the gallery, so its password still applies.
 * Only photos a guest may see are ever shown.
 */
export const load: PageServerLoad = ({ params, cookies, locals, url }) => {
	const list = getListByToken(params.token);
	const gallery = list ? getGalleryById(list.galleryId) : undefined;
	if (!list || !gallery || !sharedListFor(gallery, params.token)) error(404, 'not-found');
	locals.lang = gallery.language;

	const locked = isListLocked(cookies, gallery, list, Boolean(locals.admin));
	if (!locked) {
		addShareGrant(cookies, url, list.id);
		const seen = `flv_${list.id}`;
		if (shouldTrack(locals) && !cookies.get(seen)) {
			countShare(list.id, 'shareViews');
			cookies.set(seen, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
		}
	}

	// When the gallery has a store, the photos of the list can be bought from here (the cart takes ?share=).
	const ctx = locked ? null : storeContext(gallery);
	const cart = ctx ? getCart(cookies, gallery.id) : null;
	return {
		token: params.token,
		locked,
		open: !list.sharePrivate,
		listName: sharedListName(gallery, list),
		gallery: publicGallery(gallery, 'guest'),
		studio: studioForClients(),
		photos: locked ? [] : photosInOrder(gallery, listPhotoIds(list.id), 'guest'),
		store: ctx
			? {
					currency: ctx.store.currency,
					products: ctx.products,
					cartCount: cart ? (priceCart(gallery, 'guest', cart.items, cart.couponCode)?.count ?? 0) : 0
				}
			: null
	};
};
