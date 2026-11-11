import { redirect } from '@sveltejs/kit';
import { healthProblems } from '$lib/server/health';
import { countNotificationsSince } from '$lib/server/notifications';
import { getActivitySeenAt, getStudio } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url, depends }) => {
	if (!locals.admin) redirect(303, `/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	const studio = getStudio();
	locals.lang = studio.language;
	// The bell: refreshed on navigation and after the activity has been seen.
	depends('folio:notifications');
	return {
		admin: locals.admin,
		studioName: studio.name,
		adminLanguage: studio.language,
		unread: countNotificationsSince(getActivitySeenAt()),
		// The self-check: what needs attention is shown above every admin page.
		health: healthProblems()
	};
};
