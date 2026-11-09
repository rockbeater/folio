import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { hasAdmin, sessionUser } from '$lib/server/auth';
import { startServices } from '$lib/server/startup';

export const init: ServerInit = () => {
	startServices();
};

let setupDone = false;

function needsSetup(): boolean {
	if (!setupDone) setupDone = hasAdmin();
	return !setupDone;
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	event.locals.admin = sessionUser(event.cookies);
	event.locals.lang = 'en';

	if (pathname !== '/healthz' && !pathname.startsWith('/setup') && (pathname === '/' || pathname.startsWith('/admin'))) {
		if (needsSetup()) redirect(303, '/setup');
	}

	// Everything under /admin needs a login. Layout loads redirect pages to the login,
	// but form actions and endpoints do not run layout loads, so they are checked here.
	if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login') && !event.locals.admin) {
		const isPage = event.request.method === 'GET' && !pathname.startsWith('/admin/api') && !pathname.includes('/export/');
		if (isPage) redirect(303, `/admin/login?next=${encodeURIComponent(pathname + event.url.search)}`);
		return new Response('Unauthorized', { status: 401 });
	}

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.lang)
	});

	response.headers.set('x-robots-tag', 'noindex, nofollow, noimageindex');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'same-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
	return response;
};
