import path from 'node:path';
import { config } from '../config';
import type { DisplayWidth } from '$lib/types';

export type DownloadVariant = '3600' | '2048' | '1024' | '640';

export function photoCacheDir(photoId: string): string {
	return path.join(config.cacheDir, 'photos', photoId.slice(0, 2), photoId);
}

export function displayFile(photoId: string, version: number, width: DisplayWidth): string {
	return path.join(photoCacheDir(photoId), `v${version}-w${width}.webp`);
}

export function downloadFile(photoId: string, version: number, variant: DownloadVariant): string {
	return path.join(photoCacheDir(photoId), `v${version}-d${variant}.jpg`);
}

export function emailCoverFile(photoId: string, version: number): string {
	return path.join(photoCacheDir(photoId), `v${version}-email.jpg`);
}

export function originalFile(galleryFolder: string, sectionFolder: string, filename: string): string {
	return path.join(config.photosDir, galleryFolder, sectionFolder, filename);
}
