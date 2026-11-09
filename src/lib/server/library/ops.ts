import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { eq, inArray } from 'drizzle-orm';
import { config } from '../config';
import { getDb, schema } from '../db';
import type { Gallery, Section } from '../db/schema';
import { removePhotoCache } from '../images/render';
import { slugify, uniqueSlug } from '$lib/slug';
import { availableFileName, isImageFile, moveToTrash, pathExists, safeName, writeIdFile } from './files';
import { insertGallery, insertSection, scanLibrary } from './scanner';

export class LibraryError extends Error {
	constructor(
		public code: 'invalidName' | 'exists' | 'notFound' | 'unsupported',
		message: string
	) {
		super(message);
	}
}

function galleryDir(gallery: Pick<Gallery, 'folder'>): string {
	return path.join(config.photosDir, gallery.folder);
}

export async function createGallery(name: string, eventDate: string | null): Promise<Gallery> {
	const folder = safeName(name);
	if (!folder) throw new LibraryError('invalidName', 'Invalid gallery name');
	const dir = path.join(config.photosDir, folder);
	if (await pathExists(dir)) throw new LibraryError('exists', 'Folder already exists');
	await fs.mkdir(dir, { recursive: true });
	const id = crypto.randomUUID();
	await writeIdFile(dir, id);
	return insertGallery(id, folder, name.trim(), eventDate);
}

export async function createSection(gallery: Gallery, name: string): Promise<Section> {
	const folder = safeName(name);
	if (!folder) throw new LibraryError('invalidName', 'Invalid section name');
	const dir = path.join(galleryDir(gallery), folder);
	const existing = getDb()
		.select()
		.from(schema.sections)
		.where(eq(schema.sections.galleryId, gallery.id))
		.all()
		.find((s) => s.folder.toLowerCase() === folder.toLowerCase());
	if (existing) return existing;
	await fs.mkdir(dir, { recursive: true });
	return insertSection(gallery.id, folder);
}

export async function renameSection(gallery: Gallery, section: Section, name: string): Promise<void> {
	const folder = safeName(name);
	if (!folder) throw new LibraryError('invalidName', 'Invalid section name');
	if (folder === section.folder) return;
	const from = path.join(galleryDir(gallery), section.folder);
	const to = path.join(galleryDir(gallery), folder);
	if (folder.toLowerCase() !== section.folder.toLowerCase() && (await pathExists(to))) {
		throw new LibraryError('exists', 'A section with this name already exists');
	}
	await fs.rename(from, to);
	const db = getDb();
	const others = db
		.select({ slug: schema.sections.slug, id: schema.sections.id })
		.from(schema.sections)
		.where(eq(schema.sections.galleryId, gallery.id))
		.all()
		.filter((s) => s.id !== section.id);
	const slug = uniqueSlug(slugify(folder), (s) => others.some((o) => o.slug === s));
	db.update(schema.sections).set({ folder, slug }).where(eq(schema.sections.id, section.id)).run();
}

export async function trashSection(gallery: Gallery, section: Section): Promise<void> {
	const dir = path.join(galleryDir(gallery), section.folder);
	if (await pathExists(dir)) await moveToTrash(dir);
	const db = getDb();
	const ids = db
		.select({ id: schema.photos.id })
		.from(schema.photos)
		.where(eq(schema.photos.sectionId, section.id))
		.all()
		.map((p) => p.id);
	db.delete(schema.sections).where(eq(schema.sections.id, section.id)).run();
	await Promise.all(ids.map(removePhotoCache));
}

export async function trashPhotos(gallery: Gallery, photoIds: string[]): Promise<void> {
	if (photoIds.length === 0) return;
	const db = getDb();
	const rows = db
		.select({ id: schema.photos.id, filename: schema.photos.filename, galleryId: schema.photos.galleryId, folder: schema.sections.folder })
		.from(schema.photos)
		.innerJoin(schema.sections, eq(schema.sections.id, schema.photos.sectionId))
		.where(inArray(schema.photos.id, photoIds))
		.all()
		.filter((r) => r.galleryId === gallery.id);
	for (const row of rows) {
		const file = path.join(galleryDir(gallery), row.folder, row.filename);
		if (await pathExists(file)) await moveToTrash(file);
	}
	db.delete(schema.photos)
		.where(inArray(schema.photos.id, rows.map((r) => r.id)))
		.run();
	await Promise.all(rows.map((r) => removePhotoCache(r.id)));
}

export type DuplicatePolicy = 'skip' | 'replace' | 'rename';

const UPLOAD_ID = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Receive one chunk of an upload. Chunks are appended to a hidden temp file
 * (ignored by the scanner); the last chunk moves the file into place.
 * A chunk at the wrong offset is refused with the current size, so the
 * browser can resume after a dropped connection.
 */
export async function receiveChunk(opts: {
	gallery: Gallery;
	section: Section;
	uploadId: string;
	fileName: string;
	offset: number;
	total: number;
	body: WebReadableStream<Uint8Array>;
	maxBytes: number;
	duplicate: DuplicatePolicy;
}): Promise<{ done: false; received: number; mismatch: boolean } | { done: true; filename: string; skipped: boolean }> {
	const base = safeName(path.basename(opts.fileName));
	if (!base || !isImageFile(base)) throw new LibraryError('unsupported', 'Unsupported file type');
	if (!UPLOAD_ID.test(opts.uploadId)) throw new LibraryError('invalidName', 'Invalid upload id');
	if (opts.total > opts.maxBytes) throw new LibraryError('unsupported', 'File too large');

	const dir = path.join(galleryDir(opts.gallery), opts.section.folder);
	await fs.mkdir(dir, { recursive: true });
	const tmp = path.join(dir, `.upload-${opts.uploadId}`);
	const current = (await fs.stat(tmp).catch(() => null))?.size ?? 0;
	if (opts.offset !== current) return { done: false, received: current, mismatch: true };

	let written = 0;
	const stream = Readable.fromWeb(opts.body).on('data', (chunk: Buffer) => {
		written += chunk.length;
		if (current + written > opts.total) stream.destroy(new Error('Chunk exceeds file size'));
	});
	try {
		await pipeline(stream, createWriteStream(tmp, { flags: 'a' }));
	} catch (err) {
		// Keep what arrived intact up to the last complete chunk: truncate back.
		await fs.truncate(tmp, current).catch(() => undefined);
		throw err;
	}

	const received = current + written;
	if (received < opts.total) return { done: false, received, mismatch: false };

	const target = path.join(dir, base);
	if (await pathExists(target)) {
		if (opts.duplicate === 'skip') {
			await fs.rm(tmp, { force: true });
			return { done: true, filename: base, skipped: true };
		}
		if (opts.duplicate === 'rename') {
			const name = await availableFileName(dir, base);
			await fs.rename(tmp, path.join(dir, name));
			return { done: true, filename: name, skipped: false };
		}
	}
	// New file, or replace: the scanner sees the change and keeps the photo's id and favorites.
	await fs.rename(tmp, target);
	return { done: true, filename: base, skipped: false };
}

/** Remove upload temp files that were abandoned more than a day ago. */
export async function cleanupStaleUploads(): Promise<void> {
	const cutoff = Date.now() - 24 * 60 * 60 * 1000;
	const galleries = await fs.readdir(config.photosDir, { withFileTypes: true }).catch(() => []);
	for (const g of galleries) {
		if (!g.isDirectory() || g.name.startsWith('.')) continue;
		const sections = await fs.readdir(path.join(config.photosDir, g.name), { withFileTypes: true }).catch(() => []);
		for (const s of sections) {
			if (!s.isDirectory()) continue;
			const dir = path.join(config.photosDir, g.name, s.name);
			for (const name of await fs.readdir(dir).catch(() => [] as string[])) {
				if (!name.startsWith('.upload-')) continue;
				const stat = await fs.stat(path.join(dir, name)).catch(() => null);
				if (stat && stat.mtimeMs < cutoff) await fs.rm(path.join(dir, name), { force: true });
			}
		}
	}
}

function photosInGallery(gallery: Gallery, photoIds: string[]) {
	if (photoIds.length === 0) return [];
	return getDb()
		.select({ photo: schema.photos, folder: schema.sections.folder })
		.from(schema.photos)
		.innerJoin(schema.sections, eq(schema.sections.id, schema.photos.sectionId))
		.where(inArray(schema.photos.id, photoIds))
		.all()
		.filter((r) => r.photo.galleryId === gallery.id);
}

/**
 * Move photos to another section. The file is renamed and the photo row
 * updated right away, so the photo keeps its id, favorites and cache.
 */
export async function movePhotos(gallery: Gallery, photoIds: string[], target: Section): Promise<number> {
	let moved = 0;
	const db = getDb();
	const targetDir = path.join(galleryDir(gallery), target.folder);
	await fs.mkdir(targetDir, { recursive: true });
	let position = db
		.select({ position: schema.photos.position })
		.from(schema.photos)
		.where(eq(schema.photos.sectionId, target.id))
		.all()
		.reduce((max, p) => Math.max(max, p.position + 1), 0);
	for (const { photo, folder } of photosInGallery(gallery, photoIds)) {
		if (photo.sectionId === target.id) continue;
		const from = path.join(galleryDir(gallery), folder, photo.filename);
		const name = await availableFileName(targetDir, photo.filename);
		await fs.rename(from, path.join(targetDir, name));
		db.update(schema.photos)
			.set({ sectionId: target.id, filename: name, position: position++ })
			.where(eq(schema.photos.id, photo.id))
			.run();
		moved += 1;
	}
	return moved;
}

/** Copy photos into another section (the copies become new photos). */
export async function copyPhotos(gallery: Gallery, photoIds: string[], target: Section): Promise<number> {
	let copied = 0;
	const targetDir = path.join(galleryDir(gallery), target.folder);
	await fs.mkdir(targetDir, { recursive: true });
	for (const { photo, folder } of photosInGallery(gallery, photoIds)) {
		const name = await availableFileName(targetDir, photo.filename);
		await fs.copyFile(path.join(galleryDir(gallery), folder, photo.filename), path.join(targetDir, name));
		copied += 1;
	}
	scheduleRescan(200);
	return copied;
}

export function setPhotosHidden(gallery: Gallery, photoIds: string[], hidden: boolean): void {
	const ids = photosInGallery(gallery, photoIds).map((r) => r.photo.id);
	if (ids.length === 0) return;
	getDb().update(schema.photos).set({ hidden }).where(inArray(schema.photos.id, ids)).run();
}

/** Move the gallery folder to the library trash and remove the gallery from Folio. */
export async function trashGallery(gallery: Gallery): Promise<void> {
	const dir = galleryDir(gallery);
	if (await pathExists(dir)) await moveToTrash(dir);
	const db = getDb();
	const ids = db
		.select({ id: schema.photos.id })
		.from(schema.photos)
		.where(eq(schema.photos.galleryId, gallery.id))
		.all()
		.map((p) => p.id);
	db.delete(schema.galleries).where(eq(schema.galleries.id, gallery.id)).run();
	await Promise.all(ids.map(removePhotoCache));
}

let rescanTimer: NodeJS.Timeout | null = null;

/** Scan soon; many uploads in a row result in one scan. */
export function scheduleRescan(delay = 800): void {
	if (rescanTimer) clearTimeout(rescanTimer);
	rescanTimer = setTimeout(() => {
		rescanTimer = null;
		void scanLibrary();
	}, delay);
}
