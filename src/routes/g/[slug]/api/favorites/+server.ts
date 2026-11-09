import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getVisitorId } from '$lib/server/access';
import { photoFilter, requireOpenGallery, visitorInfo } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import { activeListId, getList, setFavorite } from '$lib/server/lists';
import type { RequestHandler } from './$types';

/** Add a photo to, or remove it from, one of the visitor's lists (the active list by default). */
export const POST: RequestHandler = async ({ params, request, cookies, locals }) => {
	const { gallery, role } = requireOpenGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (!gallery.favoritesEnabled) error(403);
	const visitorId = getVisitorId(cookies, gallery.id);
	if (!visitorId) error(401, 'email-required');

	const body = (await request.json().catch(() => ({}))) as { photoId?: unknown; favorite?: unknown; listId?: unknown };
	if (typeof body.photoId !== 'string' || typeof body.favorite !== 'boolean') error(400);

	const photo = getDb()
		.select()
		.from(schema.photos)
		.where(and(eq(schema.photos.id, body.photoId), eq(schema.photos.galleryId, gallery.id)))
		.get();
	if (!photo || !photoFilter(gallery, role)(photo)) error(404);

	const listId = typeof body.listId === 'string' ? body.listId : activeListId(cookies, gallery, visitorId);
	const list = getList(visitorId, listId);
	if (!list) error(404);
	if (!setFavorite(gallery, list, photo.id, body.favorite)) error(409, 'limit');
	return json(visitorInfo(cookies, gallery));
};
