import { eq } from 'drizzle-orm';
import { config } from '../config';
import { getDb, schema } from '../db';
import { originalFile } from './paths';
import { processPhoto } from './render';

const waiting: string[] = [];
const queued = new Set<string>();
let active = 0;

/** Add photos to the background processing queue (duplicates are ignored). */
export function enqueuePhotos(ids: Iterable<string>): void {
	for (const id of ids) {
		if (queued.has(id)) continue;
		queued.add(id);
		waiting.push(id);
	}
	pump();
}

function pump(): void {
	while (active < config.processingConcurrency && waiting.length > 0) {
		const id = waiting.shift()!;
		active += 1;
		void work(id).finally(() => {
			active -= 1;
			queued.delete(id);
			pump();
		});
	}
}

async function work(photoId: string): Promise<void> {
	const db = getDb();
	const row = db
		.select({
			photo: schema.photos,
			sectionFolder: schema.sections.folder,
			galleryFolder: schema.galleries.folder
		})
		.from(schema.photos)
		.innerJoin(schema.sections, eq(schema.sections.id, schema.photos.sectionId))
		.innerJoin(schema.galleries, eq(schema.galleries.id, schema.photos.galleryId))
		.where(eq(schema.photos.id, photoId))
		.get();
	if (!row || row.photo.status !== 'pending') return;

	const { photo } = row;
	const file = originalFile(row.galleryFolder, row.sectionFolder, photo.filename);
	try {
		const result = await processPhoto(file, photo.id, photo.version);
		db.update(schema.photos)
			.set({ ...result, status: 'ready', error: null })
			.where(eq(schema.photos.id, photo.id))
			.run();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.warn(`[folio] could not process ${file}: ${message}`);
		db.update(schema.photos)
			.set({ status: 'error', error: message.slice(0, 500) })
			.where(eq(schema.photos.id, photo.id))
			.run();
	}
}

/** Re-queue everything that is still pending, e.g. after a restart. */
export function resumePending(): void {
	const rows = getDb()
		.select({ id: schema.photos.id })
		.from(schema.photos)
		.where(eq(schema.photos.status, 'pending'))
		.all();
	enqueuePhotos(rows.map((r) => r.id));
}

export function queueSize(): number {
	return waiting.length + active;
}
