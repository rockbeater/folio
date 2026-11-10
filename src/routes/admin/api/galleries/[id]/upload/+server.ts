import { error, json } from '@sveltejs/kit';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { getGalleryById, getSection } from '$lib/server/galleries';
import { createSection, LibraryError, receiveChunk, scheduleRescan, type DuplicatePolicy } from '$lib/server/library/ops';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/log';

const log = logger('upload');

const MAX_MB = Number(process.env.UPLOAD_MAX_MB) || 500;
const POLICIES: DuplicatePolicy[] = ['skip', 'replace', 'rename'];

/**
 * Upload one chunk of a photo: PUT the raw bytes.
 * Query: name, uploadId, offset, total, duplicate=skip|replace|rename,
 * and either section=<id> or newSection=<folder name>.
 * Responds with { done: false, received } until the last chunk, then { done: true, filename, skipped }.
 * A 409 response carries the number of bytes already received, so the browser can resume.
 */
export const PUT: RequestHandler = async ({ params, url, request, locals }) => {
	if (!locals.admin) error(401);
	const gallery = getGalleryById(params.id);
	if (!gallery) error(404);
	if (!request.body) {
		log.warn('upload chunk without body (missing content-type header?)');
		error(400, 'Missing body');
	}

	const q = url.searchParams;
	let section = q.get('section') ? getSection(gallery.id, q.get('section')!) : undefined;
	if (!section && q.get('newSection')) section = await createSection(gallery, q.get('newSection')!);
	if (!section) error(400, 'Unknown section');

	const offset = Number(q.get('offset') ?? 0);
	const total = Number(q.get('total') ?? 0);
	if (!Number.isFinite(offset) || !Number.isFinite(total) || offset < 0 || total <= 0) error(400, 'Invalid range');
	const duplicate = (POLICIES as string[]).includes(q.get('duplicate') ?? '') ? (q.get('duplicate') as DuplicatePolicy) : 'skip';

	try {
		const result = await receiveChunk({
			gallery,
			section,
			uploadId: q.get('uploadId') ?? '',
			fileName: q.get('name') ?? '',
			offset,
			total,
			body: request.body as unknown as WebReadableStream<Uint8Array>,
			maxBytes: MAX_MB * 1024 * 1024,
			duplicate
		});
		if (result.done) log.info(`uploaded ${result.skipped ? '(skipped, exists) ' : ''}${gallery.folder}/${section.folder}/${result.filename}`);
		if (!result.done) {
			// On an offset mismatch, tell the browser where to continue.
			return json({ done: false, received: result.received, sectionId: section.id }, { status: result.mismatch ? 409 : 200 });
		}
		scheduleRescan();
		return json({ ...result, sectionId: section.id });
	} catch (err) {
		log.warn(`upload of "${q.get('name')}" to ${gallery.folder}/${section.folder} failed`, (err as Error).message);
		if (err instanceof LibraryError) error(err.code === 'unsupported' ? 415 : 400, err.message);
		error(400, (err as Error).message);
	}
};
