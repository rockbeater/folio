import { favoritePhotos, loadClientGallery, visitorInfo } from '$lib/server/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, cookies, locals }) => {
	const { gallery, state } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (state !== 'open') return { photos: [] };
	return { photos: favoritePhotos(gallery, visitorInfo(cookies, gallery.id).favorites) };
};
