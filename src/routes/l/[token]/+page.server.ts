import { error } from '@sveltejs/kit';
import { addShareGrant, isClient, isUnlocked } from '$lib/server/access';
import { photosInOrder, sharedListFor, studioForClients } from '$lib/server/client';
import { getGalleryById, publicGallery } from '$lib/server/galleries';
import { countShare, getListByToken, listPhotoIds } from '$lib/server/lists';
import { normalizeAccess } from '$lib/types';
import type { PageServerLoad } from './$types';

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

	const isAdmin = Boolean(locals.admin);
	const locked = !list.sharePrivate && !isAdmin && !isUnlocked(cookies, gallery) && !isClient(cookies, gallery);
	if (!locked) {
		addShareGrant(cookies, url, list.id);
		const seen = `flv_${list.id}`;
		if (!isAdmin && !cookies.get(seen)) {
			countShare(list.id, 'shareViews');
			cookies.set(seen, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
		}
	}

	const preset = list.presetId ? normalizeAccess(gallery.access).lists.find((p) => p.id === list.presetId) : undefined;
	return {
		token: params.token,
		locked,
		open: !list.sharePrivate,
		listName: preset?.name ?? list.name,
		gallery: publicGallery(gallery, 'guest'),
		studio: studioForClients(),
		photos: locked ? [] : photosInOrder(gallery, listPhotoIds(list.id), 'guest')
	};
};
