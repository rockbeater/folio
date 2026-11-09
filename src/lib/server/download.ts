import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import yazl from 'yazl';
import type { Gallery, Photo, Section } from './db/schema';
import { originalFile } from './images/paths';
import { ensureDownload } from './images/render';
import type { DownloadChoice, DownloadSettings } from '$lib/types';
import type { DownloadVariant } from './images/paths';

export interface DownloadItem {
	photo: Photo;
	section: Section;
}

/** Translate the visitor's size choice into a concrete file variant, or null if not allowed. */
export function resolveVariant(settings: DownloadSettings, choice: DownloadChoice): 'original' | DownloadVariant | null {
	if (!settings.enabled) return null;
	if (choice === 'highres' && settings.highRes) return settings.highResSize === 'original' ? 'original' : '3600';
	if (choice === 'web' && settings.web) return settings.webSize;
	return null;
}

async function fileFor(gallery: Gallery, item: DownloadItem, variant: 'original' | DownloadVariant): Promise<string> {
	const original = originalFile(gallery.folder, item.section.folder, item.photo.filename);
	if (variant === 'original') return original;
	return ensureDownload(original, item.photo.id, item.photo.version, variant);
}

function entryName(item: DownloadItem, variant: 'original' | DownloadVariant, withFolder: boolean): string {
	let name = item.photo.filename;
	if (variant !== 'original') name = `${name.slice(0, name.length - path.extname(name).length)}.jpg`;
	return withFolder ? `${item.section.folder}/${name}` : name;
}

function contentDisposition(filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** A single photo as a direct file download. */
export async function singleDownload(gallery: Gallery, item: DownloadItem, variant: 'original' | DownloadVariant): Promise<Response> {
	const file = await fileFor(gallery, item, variant);
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
	variant: 'original' | DownloadVariant,
	zipName: string
): Response {
	const zip = new yazl.ZipFile();
	const withFolders = new Set(items.map((i) => i.section.id)).size > 1;
	const used = new Set<string>();

	for (const item of items) {
		let name = entryName(item, variant, withFolders);
		for (let i = 2; used.has(name.toLowerCase()); i++) {
			const ext = path.extname(name);
			name = `${name.slice(0, name.length - ext.length)} (${i})${ext}`;
		}
		used.add(name.toLowerCase());
		zip.addReadStreamLazy(name, { compress: false, mtime: new Date(item.photo.mtimeMs) }, (cb) => {
			fileFor(gallery, item, variant)
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

/** Rough download size for the dialog ("approx. 2.3 GB"). */
export function estimateBytes(items: DownloadItem[], variant: 'original' | DownloadVariant): number {
	if (variant === 'original') return items.reduce((sum, i) => sum + i.photo.size, 0);
	const edge = Number(variant);
	return items.reduce((sum, i) => {
		const long = Math.max(i.photo.width, i.photo.height) || edge;
		const scale = Math.min(1, edge / long);
		const pixels = i.photo.width * i.photo.height * scale * scale || edge * edge * 0.66;
		return sum + pixels * 0.28; // ~0.28 bytes per pixel at JPEG q90
	}, 0);
}
