import { loadClientGallery, photosInOrder, visitorInfo } from '$lib/server/client';
import { listNotes } from '$lib/server/lists';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, cookies, locals }) => {
	const { gallery, state, role } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (state !== 'open') return { photos: [], notes: {} as Record<string, string> };
	const visitor = visitorInfo(cookies, gallery);
	return {
		photos: photosInOrder(gallery, visitor.favorites, role),
		notes: visitor.activeListId ? listNotes(visitor.activeListId) : {}
	};
};
