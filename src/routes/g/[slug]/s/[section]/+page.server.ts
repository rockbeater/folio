import { error } from '@sveltejs/kit';
import { loadClientGallery, sectionPhotos } from '$lib/server/client';
import { getSections } from '$lib/server/galleries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, cookies, locals }) => {
	const isAdmin = Boolean(locals.admin);
	const { gallery, locked } = loadClientGallery(params.slug, { cookies, isAdmin });
	if (locked) return { photos: [], sectionId: null };
	const section = getSections(gallery.id).find((s) => s.slug === params.section);
	if (!section) error(404, 'not-found');
	return { photos: sectionPhotos(gallery, section.id, isAdmin), sectionId: section.id };
};
