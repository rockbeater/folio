import crypto from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { unlockPin } from '$lib/server/access';
import { requireOpenGallery } from '$lib/server/client';
import { rateLimit, resetRateLimit } from '$lib/server/ratelimit';
import { normalizeDownload } from '$lib/types';
import type { RequestHandler } from './$types';

/** Check the download PIN and remember it for this visitor. */
export const POST: RequestHandler = async ({ params, request, cookies, locals, url, getClientAddress }) => {
	const gallery = requireOpenGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	const { pin } = normalizeDownload(gallery.download);
	if (!pin) return json({ ok: true });

	const key = `pin:${getClientAddress()}:${gallery.id}`;
	if (!rateLimit(key, 10, 15 * 60 * 1000)) error(429, 'too-many');
	const body = (await request.json().catch(() => ({}))) as { pin?: unknown };
	const given = typeof body.pin === 'string' ? body.pin.trim() : '';
	const a = crypto.createHash('sha256').update(given).digest();
	const b = crypto.createHash('sha256').update(pin).digest();
	if (!crypto.timingSafeEqual(a, b)) error(400, 'wrong-pin');

	resetRateLimit(key);
	unlockPin(cookies, url, gallery.id, pin);
	return json({ ok: true });
};
