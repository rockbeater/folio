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

/**
 * Store an uploaded photo in a section folder. The data is written to a hidden
 * temp file first (ignored by the scanner) and renamed when complete.
 */
export async function saveUpload(
	gallery: Gallery,
	section: Section,
	fileName: string,
	body: WebReadableStream<Uint8Array>,
	maxBytes: number
): Promise<string> {
	const base = safeName(path.basename(fileName));
	if (!base || !isImageFile(base)) throw new LibraryError('unsupported', 'Unsupported file type');
	const dir = path.join(galleryDir(gallery), section.folder);
	await fs.mkdir(dir, { recursive: true });
	const tmp = path.join(dir, `.upload-${crypto.randomBytes(6).toString('hex')}`);

	let written = 0;
	const limited = Readable.fromWeb(body).on('data', (chunk: Buffer) => {
		written += chunk.length;
		if (written > maxBytes) limited.destroy(new Error('File too large'));
	});
	try {
		await pipeline(limited, createWriteStream(tmp));
		const finalName = await availableFileName(dir, base);
		await fs.rename(tmp, path.join(dir, finalName));
		return finalName;
	} catch (err) {
		await fs.rm(tmp, { force: true });
		throw err;
	}
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
