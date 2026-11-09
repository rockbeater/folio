import { loadClientGallery, sectionPhotos } from '$lib/server/client';
import { getSections } from '$lib/server/galleries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, cookies, locals }) => {
	const isAdmin = Boolean(locals.admin);
	const { gallery, locked } = loadClientGallery(params.slug, { cookies, isAdmin });
	if (locked) return { photos: [], sectionId: null };
	const first = getSections(gallery.id).find((s) => sectionPhotos(gallery, s.id, isAdmin).length > 0 || isAdmin);
	return { photos: first ? sectionPhotos(gallery, first.id, isAdmin) : [], sectionId: first?.id ?? null };
};
