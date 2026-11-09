import { error, json } from '@sveltejs/kit';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { getGalleryById, getSection } from '$lib/server/galleries';
import { createSection, LibraryError, saveUpload, scheduleRescan } from '$lib/server/library/ops';
import type { RequestHandler } from './$types';

const MAX_MB = Number(process.env.UPLOAD_MAX_MB) || 500;

/**
 * Upload one photo: PUT the raw file body.
 * Query: name=<filename> and either section=<id> or newSection=<folder name>.
 */
export const PUT: RequestHandler = async ({ params, url, request, locals }) => {
	if (!locals.admin) error(401);
	const gallery = getGalleryById(params.id);
	if (!gallery) error(404);
	if (!request.body) error(400, 'Missing body');

	let section = url.searchParams.get('section') ? getSection(gallery.id, url.searchParams.get('section')!) : undefined;
	const newSection = url.searchParams.get('newSection');
	if (!section && newSection) section = await createSection(gallery, newSection);
	if (!section) error(400, 'Unknown section');

	try {
		const filename = await saveUpload(
			gallery,
			section,
			url.searchParams.get('name') ?? '',
			request.body as unknown as WebReadableStream<Uint8Array>,
			MAX_MB * 1024 * 1024
		);
		scheduleRescan();
		return json({ ok: true, filename, sectionId: section.id });
	} catch (err) {
		if (err instanceof LibraryError) error(415, err.message);
		error(400, (err as Error).message);
	}
};
