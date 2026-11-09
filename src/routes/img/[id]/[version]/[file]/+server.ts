import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { canViewGallery } from '$lib/server/access';
import { getDb, schema } from '$lib/server/db';
import { originalFile } from '$lib/server/images/paths';
import { ensureDisplay } from '$lib/server/images/render';
import { DISPLAY_WIDTHS, type DisplayWidth } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies, locals, request }) => {
	const match = /^w(\d+)\.webp$/.exec(params.file);
	const width = Number(match?.[1]) as DisplayWidth;
	if (!match || !DISPLAY_WIDTHS.includes(width)) error(404);

	const row = getDb()
		.select({ photo: schema.photos, gallery: schema.galleries, sectionFolder: schema.sections.folder })
		.from(schema.photos)
		.innerJoin(schema.galleries, eq(schema.galleries.id, schema.photos.galleryId))
		.innerJoin(schema.sections, eq(schema.sections.id, schema.photos.sectionId))
		.where(eq(schema.photos.id, params.id))
		.get();
	if (!row || !canViewGallery(row.gallery, cookies, Boolean(locals.admin))) error(404);

	const { photo, gallery } = row;
	// Old version requested: send the current one (URLs carry the version for cache busting).
	const etag = `"${photo.id}-${photo.version}-${width}"`;
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304 });

	let file: string;
	try {
		file = await ensureDisplay(originalFile(gallery.folder, row.sectionFolder, photo.filename), photo.id, photo.version, width);
	} catch {
		error(404);
	}
	const stat = await fs.promises.stat(file);
	const immutable = String(photo.version) === params.version;
	return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
		headers: {
			'content-type': 'image/webp',
			'content-length': String(stat.size),
			etag,
			'cache-control': immutable ? 'private, max-age=31536000, immutable' : 'private, no-cache'
		}
	});
};
