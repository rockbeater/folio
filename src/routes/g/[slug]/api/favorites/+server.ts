import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getVisitorId } from '$lib/server/access';
import { loadClientGallery } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, cookies, locals }) => {
	const { gallery, locked } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (locked || !gallery.favoritesEnabled) error(403);
	const visitorId = getVisitorId(cookies, gallery.id);
	if (!visitorId) error(401, 'email-required');

	const body = (await request.json().catch(() => ({}))) as { photoId?: unknown; favorite?: unknown };
	if (typeof body.photoId !== 'string' || typeof body.favorite !== 'boolean') error(400);

	const db = getDb();
	const photo = db
		.select({ id: schema.photos.id })
		.from(schema.photos)
		.where(and(eq(schema.photos.id, body.photoId), eq(schema.photos.galleryId, gallery.id)))
		.get();
	if (!photo) error(404);

	if (body.favorite) {
		db.insert(schema.favorites).values({ visitorId, photoId: photo.id }).onConflictDoNothing().run();
	} else {
		db.delete(schema.favorites)
			.where(and(eq(schema.favorites.visitorId, visitorId), eq(schema.favorites.photoId, photo.id)))
			.run();
	}
	return json({ ok: true });
};
