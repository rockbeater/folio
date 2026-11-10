import path from 'node:path';
import { config } from '../config';
import type { DisplayWidth } from '$lib/types';

export type DownloadVariant = '3600' | '2048' | '1024' | '640';

export function photoCacheDir(photoId: string): string {
	return path.join(config.cacheDir, 'photos', photoId.slice(0, 2), photoId);
}

export function displayFile(photoId: string, version: number, width: DisplayWidth, wmKey: string | null = null, sharpen = ''): string {
	return path.join(photoCacheDir(photoId), `v${version}${sharpen}-w${width}${wmKey ? `-wm${wmKey}` : ''}.webp`);
}

export function downloadFile(photoId: string, version: number, variant: DownloadVariant, wmKey: string | null = null): string {
	// "x": copies with EXIF kept (older copies without it are made again).
	return path.join(photoCacheDir(photoId), `v${version}-d${variant}x${wmKey ? `-wm${wmKey}` : ''}.jpg`);
}

export function emailCoverFile(photoId: string, version: number): string {
	return path.join(photoCacheDir(photoId), `v${version}-email.jpg`);
}

export function originalFile(galleryFolder: string, sectionFolder: string, filename: string): string {
	return path.join(config.photosDir, galleryFolder, sectionFolder, filename);
}
