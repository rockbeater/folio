import crypto from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { unlockPin } from '$lib/server/access';
import { requireGalleryOrShare } from '$lib/server/client';
import { noteFailure, rateLimit, resetRateLimit, tooManyFailures } from '$lib/server/ratelimit';
import { normalizeDownload } from '$lib/types';
import type { RequestHandler } from './$types';

/** Check the download PIN and remember it for this visitor. */
export const POST: RequestHandler = async ({ params, request, cookies, locals, url }) => {
	const body = (await request.json().catch(() => ({}))) as { pin?: unknown; share?: unknown };
	const share = typeof body.share === 'string' ? body.share : null;
	const { gallery } = requireGalleryOrShare(params.slug, { cookies, isAdmin: Boolean(locals.admin) }, share);
	const { pin } = normalizeDownload(gallery.download);
	if (!pin) return json({ ok: true });

	const key = `pin:${locals.ip}:${gallery.id}`;
	// A PIN has few combinations, so wrong guesses from all addresses together are capped as well.
	const shared = `pin-fail:${gallery.id}`;
	if (tooManyFailures(shared, 50) || !rateLimit(key, 10, 15 * 60 * 1000)) error(429, 'too-many');
	const given = typeof body.pin === 'string' ? body.pin.trim() : '';
	const a = crypto.createHash('sha256').update(given).digest();
	const b = crypto.createHash('sha256').update(pin).digest();
	if (!crypto.timingSafeEqual(a, b)) {
		noteFailure(shared, 60 * 60 * 1000);
		error(400, 'wrong-pin');
	}

	resetRateLimit(key);
	unlockPin(cookies, url, gallery.id, pin);
	return json({ ok: true });
};
