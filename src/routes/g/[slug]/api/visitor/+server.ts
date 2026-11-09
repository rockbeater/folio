import crypto from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { setVisitorId } from '$lib/server/access';
import { loadClientGallery, recordActivity, sharedListFor, visitorInfo } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Identify a visitor by email: used for favorites, downloads that require an
 * email, and the email registration before entering the gallery.
 */
export const POST: RequestHandler = async ({ params, request, cookies, locals, url, getClientAddress }) => {
	const body = (await request.json().catch(() => ({}))) as { email?: unknown; registration?: unknown; share?: unknown };
	const { gallery, state } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	// A shared list may ask for an email before downloading, even when the gallery itself is locked.
	const viaShare = Boolean(sharedListFor(gallery, typeof body.share === 'string' ? body.share : null));
	if (state !== 'open' && state !== 'register' && !viaShare) error(403, state);
	if (!rateLimit(`visitor:${getClientAddress()}`, 30, 15 * 60 * 1000)) error(429);

	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	if (!EMAIL.test(email) || email.length > 254) error(400, 'invalid-email');

	const db = getDb();
	let visitor = db
		.select()
		.from(schema.visitors)
		.where(and(eq(schema.visitors.galleryId, gallery.id), eq(schema.visitors.email, email)))
		.get();
	if (!visitor) {
		const id = crypto.randomUUID();
		db.insert(schema.visitors).values({ id, galleryId: gallery.id, email }).run();
		visitor = db.select().from(schema.visitors).where(eq(schema.visitors.id, id)).get()!;
	}
	if (body.registration === true) recordActivity(gallery.id, 'registration', email);
	setVisitorId(cookies, url, gallery.id, visitor.id);

	// cookies.get sees the cookie set above, so this already reads the new visitor.
	return json(visitorInfo(cookies, gallery));
};
