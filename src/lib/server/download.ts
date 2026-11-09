import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import yazl from 'yazl';
import type { Gallery, Photo, Section, Watermark } from './db/schema';
import { originalFile, type DownloadVariant } from './images/paths';
import { ensureDownload } from './images/render';
import type { DownloadChoice, DownloadSettings } from '$lib/types';

export interface DownloadItem {
	photo: Photo;
	section: Section;
}

export type Variant = 'original' | DownloadVariant;

/** Largest size of one ZIP file before a download is split into parts. */
export const PART_BYTES = (Number(process.env.DOWNLOAD_PART_GB) || 4) * 1024 ** 3;

/** Translate the visitor's size choice into a concrete file variant, or null if not allowed. */
export function resolveVariant(settings: DownloadSettings, choice: DownloadChoice): Variant | null {
	if (!settings.enabled) return null;
	if (choice === 'highres' && settings.highRes) return settings.highResSize === 'original' ? 'original' : '3600';
	if (choice === 'web' && settings.web) return settings.webSize;
	return null;
}

async function fileFor(gallery: Gallery, item: DownloadItem, variant: Variant, watermark: Watermark | null): Promise<string> {
	const original = originalFile(gallery.folder, item.section.folder, item.photo.filename);
	if (variant === 'original') return original;
	return ensureDownload(original, item.photo.id, item.photo.version, variant, watermark);
}

function entryName(item: DownloadItem, variant: Variant, withFolder: boolean): string {
	let name = item.photo.filename;
	if (variant !== 'original') name = `${name.slice(0, name.length - path.extname(name).length)}.jpg`;
	return withFolder ? `${item.section.folder}/${name}` : name;
}

function contentDisposition(filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** A single photo as a direct file download. */
export async function singleDownload(gallery: Gallery, item: DownloadItem, variant: Variant, watermark: Watermark | null): Promise<Response> {
	const file = await fileFor(gallery, item, variant, watermark);
	const stat = await fs.promises.stat(file);
	const ext = path.extname(file).toLowerCase();
	const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
	return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
		headers: {
			'content-type': type,
			'content-length': String(stat.size),
			'content-disposition': contentDisposition(entryName(item, variant, false)),
			'cache-control': 'private, no-store'
		}
	});
}

/**
 * Stream a ZIP while it is being built, so the download starts immediately.
 * Photos are stored without compression (JPEGs do not compress further).
 */
export function zipDownload(
	gallery: Gallery,
	items: DownloadItem[],
	variant: Variant,
	zipName: string,
	watermark: Watermark | null,
	withFolders = new Set(items.map((i) => i.section.id)).size > 1
): Response {
	const zip = new yazl.ZipFile();
	const used = new Set<string>();

	for (const item of items) {
		let name = entryName(item, variant, withFolders);
		for (let i = 2; used.has(name.toLowerCase()); i++) {
			const ext = path.extname(name);
			name = `${name.slice(0, name.length - ext.length)} (${i})${ext}`;
		}
		used.add(name.toLowerCase());
		zip.addReadStreamLazy(name, { compress: false, mtime: new Date(item.photo.mtimeMs) }, (cb) => {
			fileFor(gallery, item, variant, watermark)
				.then((file) => cb(null, fs.createReadStream(file)))
				.catch((err: Error) => cb(err, undefined as unknown as Readable));
		});
	}
	zip.end();

	return new Response(Readable.toWeb(zip.outputStream as Readable) as ReadableStream, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': contentDisposition(zipName),
			'cache-control': 'private, no-store'
		}
	});
}

/** Estimated size of one photo in a variant. */
export function estimatePhotoBytes(photo: Photo, variant: Variant): number {
	if (variant === 'original') return photo.size;
	// Scale the original file size by the reduction in pixels; re-encoding at
	// quality 90 lands close to that for typical photos.
	const edge = Number(variant);
	const long = Math.max(photo.width, photo.height) || edge;
	const scale = Math.min(1, edge / long);
	return photo.size * scale * scale;
}

/** Rough download size for the dialog ("approx. 2.3 GB"). */
export function estimateBytes(items: DownloadItem[], variant: Variant): number {
	return items.reduce((sum, i) => sum + estimatePhotoBytes(i.photo, variant), 0);
}

/** Split items into consecutive parts of at most `maxBytes` each (every part has at least one photo). */
export function splitIntoParts(items: DownloadItem[], variant: Variant, maxBytes = PART_BYTES): DownloadItem[][] {
	const parts: DownloadItem[][] = [];
	let current: DownloadItem[] = [];
	let size = 0;
	for (const item of items) {
		const bytes = estimatePhotoBytes(item.photo, variant);
		if (current.length > 0 && size + bytes > maxBytes) {
			parts.push(current);
			current = [];
			size = 0;
		}
		current.push(item);
		size += bytes;
	}
	if (current.length > 0) parts.push(current);
	return parts;
}
