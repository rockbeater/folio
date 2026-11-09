import crypto from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { setVisitorId } from '$lib/server/access';
import { loadClientGallery, recordActivity } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import { rateLimit } from '$lib/server/ratelimit';
import type { RequestHandler } from './$types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Identify a visitor by email: used for favorites, downloads that require an
 * email, and the email registration before entering the gallery.
 */
export const POST: RequestHandler = async ({ params, request, cookies, locals, url, getClientAddress }) => {
	const { gallery, state } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (state !== 'open' && state !== 'register') error(403, state);
	if (!rateLimit(`visitor:${getClientAddress()}`, 30, 15 * 60 * 1000)) error(429);

	const body = (await request.json().catch(() => ({}))) as { email?: unknown; registration?: unknown };
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

	const favorites = db
		.select({ photoId: schema.favorites.photoId })
		.from(schema.favorites)
		.where(eq(schema.favorites.visitorId, visitor.id))
		.all()
		.map((f) => f.photoId);
	return json({ email, favorites });
};
