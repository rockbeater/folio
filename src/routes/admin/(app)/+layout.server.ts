import { redirect } from '@sveltejs/kit';
import { getStudio } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.admin) redirect(303, `/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	return { admin: locals.admin, studioName: getStudio().name };
};
