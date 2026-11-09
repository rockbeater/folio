import { loadClientGallery, sectionPhotos } from '$lib/server/client';
import { getSections } from '$lib/server/galleries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, cookies, locals }) => {
	const { gallery, state } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (state !== 'open') return { photos: [], sectionId: null };
	for (const section of getSections(gallery.id)) {
		const photos = sectionPhotos(gallery, section.id);
		if (photos.length > 0) return { photos, sectionId: section.id };
	}
	return { photos: [], sectionId: null };
};
