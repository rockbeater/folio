import crypto from 'node:crypto';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { config } from '../config';
import { getDb, schema } from '../db';
import type { Gallery, ScanWarning, Section } from '../db/schema';
import { enqueuePhotos } from '../images/queue';
import { removePhotoCache } from '../images/render';
import { newGalleryValues } from '../presets';
import { slugify, uniqueSlug } from '$lib/slug';
import { isIgnored, isImageFile, readIdFile, writeIdFile } from './files';

export interface LibraryState {
	available: boolean;
	lastScanAt: number | null;
	scanning: boolean;
	error: string | null;
}

export const libraryState: LibraryState = { available: true, lastScanAt: null, scanning: false, error: null };

let running: Promise<void> | null = null;
let rerun = false;

/**
 * Scan the whole photo library. Concurrent calls are coalesced: if a scan is
 * running, one more scan is scheduled to run right after it.
 */
export function scanLibrary(): Promise<void> {
	if (running) {
		rerun = true;
		return running;
	}
	running = (async () => {
		libraryState.scanning = true;
		try {
			do {
				rerun = false;
				await scanAll();
			} while (rerun);
		} finally {
			libraryState.scanning = false;
			running = null;
		}
	})();
	return running;
}

async function isDirectory(parent: string, entry: Dirent): Promise<boolean> {
	if (entry.isDirectory()) return true;
	if (!entry.isSymbolicLink()) return false;
	const stat = await fs.stat(path.join(parent, entry.name)).catch(() => null);
	return Boolean(stat?.isDirectory());
}

async function isFile(parent: string, entry: Dirent): Promise<boolean> {
	if (entry.isFile()) return true;
	if (!entry.isSymbolicLink()) return false;
	const stat = await fs.stat(path.join(parent, entry.name)).catch(() => null);
	return Boolean(stat?.isFile());
}

async function scanAll(): Promise<void> {
	let entries: Dirent[];
	try {
		entries = await fs.readdir(config.photosDir, { withFileTypes: true });
	} catch (err) {
		// Never touch the database when the library is unreachable (e.g. NAS not mounted).
		libraryState.available = false;
		libraryState.error = err instanceof Error ? err.message : String(err);
		console.warn(`[folio] photo library not readable at ${config.photosDir}: ${libraryState.error}`);
		return;
	}
	libraryState.available = true;
	libraryState.error = null;

	const seen = new Set<string>();
	for (const entry of entries) {
		if (isIgnored(entry.name) || !(await isDirectory(config.photosDir, entry))) continue;
		try {
			seen.add(await scanGallery(entry.name, seen));
		} catch (err) {
			console.warn(`[folio] could not scan gallery folder "${entry.name}":`, err);
		}
	}

	const db = getDb();
	for (const g of db.select({ id: schema.galleries.id, missing: schema.galleries.missing }).from(schema.galleries).all()) {
		const missing = !seen.has(g.id);
		if (missing !== g.missing) db.update(schema.galleries).set({ missing }).where(eq(schema.galleries.id, g.id)).run();
	}
	libraryState.lastScanAt = Date.now();
}

function slugTaken(slug: string): boolean {
	return Boolean(
		getDb().select({ id: schema.galleries.id }).from(schema.galleries).where(eq(schema.galleries.slug, slug)).get()
	);
}

/** Insert a new gallery row for a folder. Exported for the admin "new gallery" action. */
export function insertGallery(id: string, folder: string, name: string, eventDate: string | null = null): Gallery {
	const db = getDb();
	const values = {
		id,
		folder,
		name,
		slug: uniqueSlug(slugify(name), slugTaken),
		eventDate,
		status: 'draft' as const,
		...newGalleryValues()
	};
	db.insert(schema.galleries).values(values).run();
	return db.select().from(schema.galleries).where(eq(schema.galleries.id, id)).get()!;
}

export function insertSection(galleryId: string, folder: string): Section {
	const db = getDb();
	const existing = db.select().from(schema.sections).where(eq(schema.sections.galleryId, galleryId)).all();
	const slugs = new Set(existing.map((s) => s.slug));
	const section = {
		id: crypto.randomUUID(),
		galleryId,
		folder,
		slug: uniqueSlug(slugify(folder), (s) => slugs.has(s)),
		position: existing.reduce((max, s) => Math.max(max, s.position + 1), 0)
	};
	db.insert(schema.sections).values(section).run();
	return db.select().from(schema.sections).where(eq(schema.sections.id, section.id)).get()!;
}

async function scanGallery(folder: string, seen: Set<string>): Promise<string> {
	const db = getDb();
	const dir = path.join(config.photosDir, folder);
	const warnings: ScanWarning[] = [];

	let fileId = await readIdFile(dir);
	// A copied folder carries the same id file as its original: treat the copy as a new gallery.
	if (fileId && seen.has(fileId)) fileId = null;

	let gallery = fileId ? db.select().from(schema.galleries).where(eq(schema.galleries.id, fileId)).get() : undefined;
	if (!gallery && !fileId) {
		// Folders we could not write an id file to are matched by name.
		const byFolder = db.select().from(schema.galleries).where(eq(schema.galleries.folder, folder)).get();
		if (byFolder && !seen.has(byFolder.id)) gallery = byFolder;
	}
	if (!gallery) gallery = insertGallery(fileId ?? crypto.randomUUID(), folder, folder);
	if (gallery.folder !== folder) {
		db.update(schema.galleries).set({ folder }).where(eq(schema.galleries.id, gallery.id)).run();
		gallery = { ...gallery, folder };
	}
	if (fileId !== gallery.id) {
		try {
			await writeIdFile(dir, gallery.id);
		} catch {
			warnings.push({ code: 'readOnly' });
		}
	}

	const entries = await fs.readdir(dir, { withFileTypes: true });
	let rootImages = 0;
	const sectionFolders: string[] = [];
	for (const entry of entries) {
		if (isIgnored(entry.name)) continue;
		if (await isDirectory(dir, entry)) sectionFolders.push(entry.name);
		else if (isImageFile(entry.name) && (await isFile(dir, entry))) rootImages += 1;
	}
	if (rootImages > 0) warnings.push({ code: 'rootImages', count: rootImages });

	const existing = new Map(
		db.select().from(schema.sections).where(eq(schema.sections.galleryId, gallery.id)).all().map((s) => [s.folder, s])
	);
	for (const sectionFolder of sectionFolders) {
		const section = existing.get(sectionFolder) ?? insertSection(gallery.id, sectionFolder);
		existing.delete(sectionFolder);
		try {
			await scanSection(gallery, section, warnings);
		} catch (err) {
			console.warn(`[folio] could not scan section "${folder}/${sectionFolder}":`, (err as Error).message);
		}
	}

	// Sections whose folder is gone.
	for (const section of existing.values()) {
		const photoIds = db
			.select({ id: schema.photos.id })
			.from(schema.photos)
			.where(eq(schema.photos.sectionId, section.id))
			.all()
			.map((p) => p.id);
		db.delete(schema.sections).where(eq(schema.sections.id, section.id)).run();
		await Promise.all(photoIds.map(removePhotoCache));
	}

	// Clear a cover that no longer exists.
	if (gallery.coverPhotoId) {
		const cover = db.select({ id: schema.photos.id }).from(schema.photos).where(eq(schema.photos.id, gallery.coverPhotoId)).get();
		if (!cover) db.update(schema.galleries).set({ coverPhotoId: null }).where(eq(schema.galleries.id, gallery.id)).run();
	}

	if (JSON.stringify(warnings) !== JSON.stringify(gallery.warnings)) {
		db.update(schema.galleries).set({ warnings }).where(eq(schema.galleries.id, gallery.id)).run();
	}
	return gallery.id;
}

async function scanSection(gallery: Gallery, section: Section, warnings: ScanWarning[]): Promise<void> {
	const db = getDb();
	const dir = path.join(config.photosDir, gallery.folder, section.folder);
	const entries = await fs.readdir(dir, { withFileTypes: true });

	let nested = 0;
	let unsupported = 0;
	const found: { name: string; size: number; mtimeMs: number }[] = [];
	for (const entry of entries) {
		if (isIgnored(entry.name)) continue;
		if (await isDirectory(dir, entry)) {
			nested += 1;
			continue;
		}
		if (!isImageFile(entry.name)) {
			unsupported += 1;
			continue;
		}
		const stat = await fs.stat(path.join(dir, entry.name)).catch(() => null);
		if (stat?.isFile()) found.push({ name: entry.name, size: stat.size, mtimeMs: Math.floor(stat.mtimeMs) });
	}
	if (nested > 0) warnings.push({ code: 'nestedFolders', section: section.folder, count: nested });
	if (unsupported > 0) warnings.push({ code: 'unsupportedFiles', section: section.folder, count: unsupported });

	const existing = new Map(
		db.select().from(schema.photos).where(eq(schema.photos.sectionId, section.id)).all().map((p) => [p.filename, p])
	);
	const toProcess: string[] = [];
	let nextPosition = [...existing.values()].reduce((max, p) => Math.max(max, p.position + 1), 0);

	db.transaction((tx) => {
		for (const file of found) {
			const photo = existing.get(file.name);
			existing.delete(file.name);
			if (!photo) {
				const id = crypto.randomUUID();
				tx.insert(schema.photos)
					.values({
						id,
						galleryId: gallery.id,
						sectionId: section.id,
						filename: file.name,
						size: file.size,
						mtimeMs: file.mtimeMs,
						position: nextPosition++
					})
					.run();
				toProcess.push(id);
			} else if (photo.size !== file.size || photo.mtimeMs !== file.mtimeMs) {
				tx.update(schema.photos)
					.set({ size: file.size, mtimeMs: file.mtimeMs, version: photo.version + 1, status: 'pending', error: null })
					.where(eq(schema.photos.id, photo.id))
					.run();
				toProcess.push(photo.id);
			} else if (photo.status === 'pending') {
				toProcess.push(photo.id);
			}
		}
		const removed = [...existing.values()].map((p) => p.id);
		if (removed.length > 0) {
			tx.delete(schema.photos)
				.where(and(eq(schema.photos.sectionId, section.id), inArray(schema.photos.id, removed)))
				.run();
		}
	});

	await Promise.all([...existing.values()].map((p) => removePhotoCache(p.id)));
	enqueuePhotos(toProcess);
}
