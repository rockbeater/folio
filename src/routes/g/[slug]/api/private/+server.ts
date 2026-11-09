import { error, json } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { requireOpenGallery } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import { publicGallery } from '$lib/server/galleries';
import type { RequestHandler } from './$types';

/** The client marks photos as private (hidden from guests) or removes the mark. */
export const POST: RequestHandler = async ({ params, request, cookies, locals }) => {
	const { gallery, role } = requireOpenGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (!publicGallery(gallery, role).canMarkPrivate) error(403);
	const body = (await request.json().catch(() => ({}))) as { photoIds?: unknown; private?: unknown };
	const ids = Array.isArray(body.photoIds) ? body.photoIds.filter((v): v is string => typeof v === 'string').slice(0, 1000) : [];
	if (ids.length === 0 || typeof body.private !== 'boolean') error(400);
	getDb()
		.update(schema.photos)
		.set({ private: body.private })
		.where(and(eq(schema.photos.galleryId, gallery.id), inArray(schema.photos.id, ids)))
		.run();
	return json({ ok: true });
};
