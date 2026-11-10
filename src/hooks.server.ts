import { redirect, type Handle, type HandleServerError, type ServerInit } from '@sveltejs/kit';
import { logger } from '$lib/server/log';
import { clientIp, noteAdminIp } from '$lib/server/visitors';
import { getPreferences } from '$lib/server/settings';
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

function isHomepageIndexable(): boolean {
	const prefs = getPreferences();
	return prefs.searchVisibility === 'homepage' && prefs.homepage.enabled;
}

const log = logger('http');

/** Unexpected errors (500): log the full error, show the visitor a short message. */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	if (status >= 500) log.error(`${event.request.method} ${event.url.pathname} failed`, error);
	return { message };
};

export const handle: Handle = async ({ event, resolve }) => {
	const started = Date.now();
	const { pathname } = event.url;
	event.locals.admin = sessionUser(event.cookies);
	event.locals.lang = 'en';
	event.locals.ip = clientIp(event.request, event.getClientAddress);
	if (event.locals.admin) noteAdminIp(event.locals.ip);

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

	// Nothing is indexed, except the homepage when the photographer allows it.
	const indexable = pathname === '/' && !event.locals.admin && isHomepageIndexable();
	if (!indexable) response.headers.set('x-robots-tag', 'noindex, nofollow, noimageindex');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'same-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

	// Log changes (form posts, uploads, API calls) and failures; plain page and image views are left out.
	const method = event.request.method;
	const status = response.status;
	if (status >= 500) log.error(`${method} ${pathname} ${status} ${Date.now() - started}ms`);
	else if (method !== 'GET' || (status >= 400 && status !== 404 && !pathname.startsWith('/img/'))) {
		const line = `${method} ${pathname}${event.url.search.startsWith('?/') ? event.url.search : ''} ${status} ${Date.now() - started}ms`;
		if (status >= 400) log.warn(line);
		else log.info(line);
	}
	return response;
};
