import { redirect } from '@sveltejs/kit';
import { getStudio } from '$lib/server/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.admin) redirect(303, '/admin');
	return { studioName: getStudio().name };
};
