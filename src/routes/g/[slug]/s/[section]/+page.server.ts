import { error } from '@sveltejs/kit';
import { loadClientGallery, sectionPhotos } from '$lib/server/client';
import { normalizeAccess } from '$lib/types';
import { getSections } from '$lib/server/galleries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, cookies, locals }) => {
	const { gallery, state, role } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (state !== 'open') return { photos: [], sectionId: null };
	const section = getSections(gallery.id).find((s) => s.slug === params.section);
	if (!section) error(404, 'not-found');
	const access = normalizeAccess(gallery.access);
	if (role === 'guest' && access.clientEnabled && access.clientSections.includes(section.id)) error(404, 'not-found');
	return { photos: sectionPhotos(gallery, section.id, role), sectionId: section.id };
};
