import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { canViewGallery, isPubliclyVisible } from '$lib/server/access';
import { canSeeSharedPhoto, gateCoverPhoto, photoFilter, roleFor } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import { originalFile } from '$lib/server/images/paths';
import { ensureDisplay, sharpenKey } from '$lib/server/images/render';
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
	const keyMatch = /^(\d+)(s[12])?(?:-([a-f0-9]+))?$/.exec(params.version);
	if (!match || !DISPLAY_WIDTHS.includes(width) || !keyMatch) error(404);

	const row = getDb()
		.select({ photo: schema.photos, gallery: schema.galleries, sectionFolder: schema.sections.folder })
		.from(schema.photos)
		.innerJoin(schema.galleries, eq(schema.galleries.id, schema.photos.galleryId))
		.innerJoin(schema.sections, eq(schema.sections.id, schema.photos.sectionId))
		.where(eq(schema.photos.id, params.id))
		.get();
	const isAdmin = Boolean(locals.admin);
	if (!row) error(404);
	// Inside the gallery the role decides (guests never get private or client-only photos);
	// outside it, a shared favorite list or quick share link this browser opened may allow it.
	const role = roleFor(row.gallery, cookies, isAdmin);
	const inGallery = ((role === 'client' && isPubliclyVisible(row.gallery)) || canViewGallery(row.gallery, cookies, false)) && photoFilter(row.gallery, role)(row.photo);
	// The entry screens show the cover photo before the gallery is opened.
	const isGateCover = () => isPubliclyVisible(row.gallery) && gateCoverPhoto(row.gallery)?.id === row.photo.id;
	if (!isAdmin && !inGallery && !isGateCover() && !canSeeSharedPhoto(cookies, row.gallery, row.photo)) error(404);

	const { photo, gallery } = row;
	const galleryWatermark = getWatermark(gallery.watermarkId) ?? null;
	const watermark = isAdmin ? (keyMatch[3] ? galleryWatermark : null) : galleryWatermark;
	const wmKey = watermarkKey(watermark);

	const sharpen = sharpenKey();
	const etag = `"${photo.id}-${photo.version}${sharpen}-${width}-${wmKey ?? 'plain'}"`;
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304 });

	let file: string;
	try {
		file = await ensureDisplay(originalFile(gallery.folder, row.sectionFolder, photo.filename), photo.id, photo.version, width, watermark);
	} catch {
		error(404);
	}
	const stat = await fs.promises.stat(file);
	const current = keyMatch[1] === String(photo.version) && (keyMatch[2] ?? '') === sharpen && (keyMatch[3] ?? null) === wmKey;
	return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
		headers: {
			'content-type': 'image/webp',
			'content-length': String(stat.size),
			etag,
			'cache-control': current ? 'private, max-age=31536000, immutable' : 'private, no-cache'
		}
	});
};
