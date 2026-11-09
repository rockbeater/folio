import { getPreferences } from '$lib/server/settings';
import type { RequestHandler } from './$types';

/** Search engines may only see the homepage, and only when the photographer allows it. Galleries are never indexed. */
export const GET: RequestHandler = () => {
	const prefs = getPreferences();
	const homepage = prefs.searchVisibility === 'homepage' && prefs.homepage.enabled;
	const body = homepage ? 'User-agent: *\nAllow: /$\nDisallow: /\n' : 'User-agent: *\nDisallow: /\n';
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
