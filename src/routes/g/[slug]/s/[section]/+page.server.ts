import { error } from '@sveltejs/kit';
import { loadClientGallery, sectionPhotos } from '$lib/server/client';
import { getSections } from '$lib/server/galleries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, cookies, locals }) => {
	const { gallery, state } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (state !== 'open') return { photos: [], sectionId: null };
	const section = getSections(gallery.id).find((s) => s.slug === params.section);
	if (!section) error(404, 'not-found');
	return { photos: sectionPhotos(gallery, section.id), sectionId: section.id };
};
