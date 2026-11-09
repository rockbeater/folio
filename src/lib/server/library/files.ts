import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config, ID_FILE, TRASH_FOLDER } from '../config';

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const SYSTEM_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', 'icon\r']);

/**
 * Hidden and NAS system entries that are never part of a gallery:
 * dot files (incl. our own id file and trash), Synology "@eaDir" and "#recycle", etc.
 */
export function isIgnored(name: string): boolean {
	return (
		name.startsWith('.') ||
		name.startsWith('@') ||
		name.startsWith('#') ||
		name.startsWith('~$') ||
		SYSTEM_FILES.has(name.toLowerCase())
	);
}

export function isImageFile(name: string): boolean {
	return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readIdFile(dir: string): Promise<string | null> {
	try {
		const id = (await fs.readFile(path.join(dir, ID_FILE), 'utf8')).trim();
		return UUID.test(id) ? id.toLowerCase() : null;
	} catch {
		return null;
	}
}

export async function writeIdFile(dir: string, id: string): Promise<void> {
	await fs.writeFile(path.join(dir, ID_FILE), `${id}\n`, 'utf8');
}

const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Make a user-supplied name safe to use as a single folder or file name. */
export function safeName(input: string): string {
	return input
		.normalize('NFC')
		.replace(FORBIDDEN, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^[.@#~]+/, '')
		.replace(/[. ]+$/, '')
		.slice(0, 120);
}

export async function pathExists(p: string): Promise<boolean> {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

/** "photo.jpg" -> "photo (2).jpg" if taken. */
export async function availableFileName(dir: string, name: string): Promise<string> {
	if (!(await pathExists(path.join(dir, name)))) return name;
	const ext = path.extname(name);
	const stem = name.slice(0, name.length - ext.length);
	for (let i = 2; ; i++) {
		const candidate = `${stem} (${i})${ext}`;
		if (!(await pathExists(path.join(dir, candidate)))) return candidate;
	}
}

/** Move a file or folder from the library into the library's trash folder. */
export async function moveToTrash(target: string): Promise<void> {
	const trash = path.join(config.photosDir, TRASH_FOLDER);
	await fs.mkdir(trash, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const dest = path.join(trash, `${stamp}_${crypto.randomBytes(3).toString('hex')}_${path.basename(target)}`);
	await fs.rename(target, dest);
}

/** Permanently delete trash entries older than the retention period. */
export async function purgeTrash(): Promise<void> {
	const trash = path.join(config.photosDir, TRASH_FOLDER);
	const entries = await fs.readdir(trash).catch(() => [] as string[]);
	const cutoff = Date.now() - config.trashRetentionDays * 24 * 60 * 60 * 1000;
	for (const name of entries) {
		const full = path.join(trash, name);
		const stat = await fs.lstat(full).catch(() => null);
		if (stat && stat.mtimeMs < cutoff) await fs.rm(full, { recursive: true, force: true });
	}
}
