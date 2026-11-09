import { error, json } from '@sveltejs/kit';
import { clientPasswordOf, loginClient, logoutClient, samePassword, unlockGallery } from '$lib/server/access';
import { loadClientGallery } from '$lib/server/client';
import { rateLimit, resetRateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

/** Log in as the client with the client password. */
export const POST: RequestHandler = async ({ params, request, cookies, locals, url, getClientAddress }) => {
	const { gallery, state } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (state === 'expired') error(403, state);
	const password = clientPasswordOf(gallery);
	if (!password) error(404);

	const key = `client:${getClientAddress()}:${gallery.id}`;
	if (!rateLimit(key, 10, 15 * 60 * 1000)) error(429, 'too-many');
	const body = (await request.json().catch(() => ({}))) as { password?: unknown };
	const given = typeof body.password === 'string' ? body.password.trim() : '';
	if (!samePassword(given, password)) error(400, 'wrong');

	resetRateLimit(key);
	loginClient(cookies, url, gallery);
	if (gallery.password) unlockGallery(cookies, url, gallery);
	return json({ ok: true });
};

export const DELETE: RequestHandler = ({ params, cookies, locals }) => {
	const { gallery } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	logoutClient(cookies, gallery);
	return json({ ok: true });
};
