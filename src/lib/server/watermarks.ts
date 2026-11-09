import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { asc, eq } from 'drizzle-orm';
import { config } from './config';
import { getDb, schema } from './db';
import type { Watermark } from './db/schema';
import type { WatermarkPosition } from '$lib/types';

export function watermarksDir(): string {
	return path.join(config.dataDir, 'watermarks');
}

export function listWatermarks(): Watermark[] {
	return getDb().select().from(schema.watermarks).orderBy(asc(schema.watermarks.createdAt)).all();
}

export function getWatermark(id: string | null | undefined): Watermark | undefined {
	if (!id) return undefined;
	return getDb().select().from(schema.watermarks).where(eq(schema.watermarks.id, id)).get();
}

/** Short, URL-safe key that changes whenever the watermark changes (used for cache busting). */
export function watermarkKey(wm: Pick<Watermark, 'id' | 'version'> | undefined | null): string | null {
	if (!wm) return null;
	return crypto.createHash('sha1').update(`${wm.id}:${wm.version}`).digest('hex').slice(0, 10);
}

const GRAVITY: Record<Exclude<WatermarkPosition, 'tile'>, string> = {
	center: 'centre',
	'top-left': 'northwest',
	top: 'north',
	'top-right': 'northeast',
	left: 'west',
	right: 'east',
	'bottom-left': 'southwest',
	bottom: 'south',
	'bottom-right': 'southeast'
};

const prepared = new Map<string, Promise<Buffer>>();

/** The watermark PNG scaled for a photo of the given size, with opacity and margin applied. */
function preparedWatermark(wm: Watermark, width: number, height: number): Promise<Buffer> {
	const key = `${wm.id}:${wm.version}:${width}x${height}`;
	let job = prepared.get(key);
	if (!job) {
		job = (async () => {
			const targetWidth = Math.max(16, Math.round(width * wm.scale));
			const resized = await sharp(path.join(watermarksDir(), wm.file))
				.resize({ width: targetWidth, height: Math.round(height * 0.9), fit: 'inside' })
				.ensureAlpha()
				.toBuffer();
			const alpha = Math.round(Math.min(1, Math.max(0, wm.opacity)) * 255);
			let image = sharp(resized).composite([
				{ input: Buffer.from([255, 255, 255, alpha]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }
			]);
			const margin = Math.round(Math.min(width, height) * (wm.position === 'tile' ? 0.06 : 0.03));
			if (margin > 0) {
				image = sharp(await image.png().toBuffer()).extend({
					top: margin,
					bottom: margin,
					left: margin,
					right: margin,
					background: { r: 0, g: 0, b: 0, alpha: 0 }
				});
			}
			return image.png().toBuffer();
		})();
		prepared.set(key, job);
		// Keep the cache small.
		if (prepared.size > 64) prepared.delete(prepared.keys().next().value!);
	}
	return job;
}

/** Composite the watermark onto an image (already rotated/resized) and return a sharp pipeline. */
export async function withWatermark(input: Buffer, wm: Watermark): Promise<Sharp> {
	const meta = await sharp(input).metadata();
	const width = meta.width ?? 0;
	const height = meta.height ?? 0;
	const overlay = await preparedWatermark(wm, width, height);
	return sharp(input).composite([
		wm.position === 'tile' ? { input: overlay, tile: true, gravity: 'northwest' } : { input: overlay, gravity: GRAVITY[wm.position] }
	]);
}

export async function saveWatermarkImage(data: Buffer): Promise<string> {
	await fs.mkdir(watermarksDir(), { recursive: true });
	const file = `wm-${crypto.randomBytes(6).toString('hex')}.png`;
	// Normalize to PNG with alpha and a sensible maximum size.
	await sharp(data, { density: 300 })
		.resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
		.ensureAlpha()
		.png()
		.toFile(path.join(watermarksDir(), file));
	return file;
}

export async function removeWatermarkFile(file: string): Promise<void> {
	await fs.rm(path.join(watermarksDir(), path.basename(file)), { force: true });
}
