import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { canViewGallery } from '$lib/server/access';
import { getDb, schema } from '$lib/server/db';
import { originalFile } from '$lib/server/images/paths';
import { ensureDisplay } from '$lib/server/images/render';
import { getWatermark, watermarkKey } from '$lib/server/watermarks';
import { DISPLAY_WIDTHS, type DisplayWidth } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * Display copies: /img/<photo id>/<version>[-<watermark key>]/w<width>.webp
 * Clients always get the gallery's watermark, whatever the URL says. The owner
 * gets exactly what the URL asks for (the admin uses unwatermarked copies).
 */
export const GET: RequestHandler = async ({ params, cookies, locals, request }) => {
	const match = /^w(\d+)\.webp$/.exec(params.file);
	const width = Number(match?.[1]) as DisplayWidth;
	const keyMatch = /^(\d+)(?:-([a-f0-9]+))?$/.exec(params.version);
	if (!match || !DISPLAY_WIDTHS.includes(width) || !keyMatch) error(404);

	const row = getDb()
		.select({ photo: schema.photos, gallery: schema.galleries, sectionFolder: schema.sections.folder })
		.from(schema.photos)
		.innerJoin(schema.galleries, eq(schema.galleries.id, schema.photos.galleryId))
		.innerJoin(schema.sections, eq(schema.sections.id, schema.photos.sectionId))
		.where(eq(schema.photos.id, params.id))
		.get();
	const isAdmin = Boolean(locals.admin);
	if (!row || !canViewGallery(row.gallery, cookies, isAdmin)) error(404);
	if (row.photo.hidden && !isAdmin) error(404);

	const { photo, gallery } = row;
	const galleryWatermark = getWatermark(gallery.watermarkId) ?? null;
	const watermark = isAdmin ? (keyMatch[2] ? galleryWatermark : null) : galleryWatermark;
	const wmKey = watermarkKey(watermark);

	const etag = `"${photo.id}-${photo.version}-${width}-${wmKey ?? 'plain'}"`;
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304 });

	let file: string;
	try {
		file = await ensureDisplay(originalFile(gallery.folder, row.sectionFolder, photo.filename), photo.id, photo.version, width, watermark);
	} catch {
		error(404);
	}
	const stat = await fs.promises.stat(file);
	const current = keyMatch[1] === String(photo.version) && (keyMatch[2] ?? null) === wmKey;
	return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
		headers: {
			'content-type': 'image/webp',
			'content-length': String(stat.size),
			etag,
			'cache-control': current ? 'private, max-age=31536000, immutable' : 'private, no-cache'
		}
	});
};
