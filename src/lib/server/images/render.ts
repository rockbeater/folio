import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';
import { DISPLAY_WIDTHS, type DisplayWidth } from '$lib/types';
import { displayFile, downloadFile, emailCoverFile, photoCacheDir, type DownloadVariant } from './paths';

sharp.cache(false);

export interface AnalyzedPhoto {
	width: number;
	height: number;
	takenAt: number | null;
	color: string;
	placeholder: string;
}

const LARGEST = DISPLAY_WIDTHS[DISPLAY_WIDTHS.length - 1];

function hex(n: number): string {
	return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

async function readTakenAt(file: string): Promise<number | null> {
	try {
		const exif = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] });
		const date: unknown = exif?.DateTimeOriginal ?? exif?.CreateDate;
		return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
	} catch {
		return null;
	}
}

/** Write atomically: render to a temp file next to the target, then rename. */
async function writeAtomic(target: string, render: (tmp: string) => Promise<unknown>): Promise<void> {
	const tmp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
	try {
		await render(tmp);
		await fs.rename(tmp, target);
	} catch (err) {
		await fs.rm(tmp, { force: true });
		throw err;
	}
}

/** Remove cached files from older versions of a photo. */
async function pruneOldVersions(photoId: string, version: number): Promise<void> {
	const dir = photoCacheDir(photoId);
	const entries = await fs.readdir(dir).catch(() => [] as string[]);
	await Promise.all(
		entries
			.filter((name) => !name.startsWith(`v${version}-`))
			.map((name) => fs.rm(path.join(dir, name), { force: true }))
	);
}

/**
 * Read an original, generate all WebP display copies in the cache and return
 * its oriented dimensions, capture date, dominant color and a tiny placeholder.
 */
export async function processPhoto(original: string, photoId: string, version: number): Promise<AnalyzedPhoto> {
	await fs.mkdir(photoCacheDir(photoId), { recursive: true });

	// Decode once, auto-orient from EXIF, scale to the largest display width and
	// keep the pixels in memory; smaller copies are derived from that buffer.
	const { data, info } = await sharp(original, { failOn: 'none' })
		.rotate()
		.resize({ width: LARGEST, height: LARGEST * 2, fit: 'inside', withoutEnlargement: true })
		.toColourspace('srgb')
		.raw()
		.toBuffer({ resolveWithObject: true });
	const raw = { raw: { width: info.width, height: info.height, channels: info.channels } } as const;

	const meta = await sharp(original, { failOn: 'none' }).metadata();
	const swap = (meta.orientation ?? 1) >= 5;
	const width = (swap ? meta.height : meta.width) ?? info.width;
	const height = (swap ? meta.width : meta.height) ?? info.height;

	for (const w of DISPLAY_WIDTHS) {
		await writeAtomic(displayFile(photoId, version, w), (tmp) =>
			sharp(data, raw)
				.resize({ width: w, withoutEnlargement: true })
				.webp({ quality: w <= 480 ? 74 : 80, effort: 4 })
				.toFile(tmp)
		);
	}

	const stats = await sharp(data, raw).stats();
	const color = `#${hex(stats.dominant.r)}${hex(stats.dominant.g)}${hex(stats.dominant.b)}`;
	const tiny = await sharp(data, raw).resize({ width: 24 }).webp({ quality: 45 }).toBuffer();

	await pruneOldVersions(photoId, version);

	return {
		width,
		height,
		takenAt: await readTakenAt(original),
		color,
		placeholder: `data:image/webp;base64,${tiny.toString('base64')}`
	};
}

const inFlight = new Map<string, Promise<string>>();

/** Generate a file once even if several requests ask for it at the same time. */
function once(target: string, render: (tmp: string) => Promise<unknown>): Promise<string> {
	const existing = inFlight.get(target);
	if (existing) return existing;
	const job = (async () => {
		try {
			await fs.access(target);
		} catch {
			await fs.mkdir(path.dirname(target), { recursive: true });
			await writeAtomic(target, render);
		}
		return target;
	})().finally(() => inFlight.delete(target));
	inFlight.set(target, job);
	return job;
}

/** Display copy, regenerated from the original if the cache was cleared. */
export function ensureDisplay(original: string, photoId: string, version: number, width: DisplayWidth): Promise<string> {
	return once(displayFile(photoId, version, width), (tmp) =>
		sharp(original, { failOn: 'none' })
			.rotate()
			.resize({ width, withoutEnlargement: true })
			.toColourspace('srgb')
			.webp({ quality: width <= 480 ? 74 : 80, effort: 4 })
			.toFile(tmp)
	);
}

/** Resized JPEG for downloads; the long edge is at most `variant` pixels. */
export function ensureDownload(original: string, photoId: string, version: number, variant: DownloadVariant): Promise<string> {
	const size = Number(variant);
	return once(downloadFile(photoId, version, variant), (tmp) =>
		sharp(original, { failOn: 'none' })
			.rotate()
			.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
			.toColourspace('srgb')
			.jpeg({ quality: 90, mozjpeg: true })
			.toFile(tmp)
	);
}

/** Cover image embedded in emails. */
export function ensureEmailCover(original: string, photoId: string, version: number): Promise<string> {
	return once(emailCoverFile(photoId, version), (tmp) =>
		sharp(original, { failOn: 'none' })
			.rotate()
			.resize({ width: 1200, height: 1500, fit: 'inside', withoutEnlargement: true })
			.toColourspace('srgb')
			.jpeg({ quality: 82, mozjpeg: true })
			.toFile(tmp)
	);
}

export async function removePhotoCache(photoId: string): Promise<void> {
	await fs.rm(photoCacheDir(photoId), { recursive: true, force: true });
}
