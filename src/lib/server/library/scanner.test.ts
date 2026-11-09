import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-scan-'));
const photos = path.join(tmp, 'photos');
process.env.PHOTOS_DIR = photos;
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.CACHE_DIR = path.join(tmp, 'cache');

async function makeJpeg(file: string, width: number, height: number, color: string) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	await sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toFile(file);
}

async function waitFor(check: () => boolean, timeoutMs = 20_000) {
	const start = Date.now();
	while (!check()) {
		if (Date.now() - start > timeoutMs) throw new Error('timed out');
		await new Promise((r) => setTimeout(r, 50));
	}
}

let scanner: typeof import('./scanner');
let db: typeof import('../db');

beforeAll(async () => {
	await makeJpeg(path.join(photos, 'Wedding', 'Ceremony', 'IMG_10.jpg'), 3000, 2000, '#a0522d');
	await makeJpeg(path.join(photos, 'Wedding', 'Ceremony', 'IMG_2.jpg'), 2000, 3000, '#4682b4');
	await makeJpeg(path.join(photos, 'Wedding', 'stray.jpg'), 100, 100, '#000000');
	fs.writeFileSync(path.join(photos, 'Wedding', 'Ceremony', 'notes.txt'), 'hello');
	fs.mkdirSync(path.join(photos, 'Wedding', 'Ceremony', 'nested'), { recursive: true });
	fs.mkdirSync(path.join(photos, '@eaDir'), { recursive: true });
	fs.mkdirSync(path.join(photos, '.trash'), { recursive: true });
	scanner = await import('./scanner');
	db = await import('../db');
});

afterAll(() => {
	fs.rmSync(tmp, { recursive: true, force: true });
});

function galleries() {
	return db.getDb().select().from(db.schema.galleries).all();
}

describe('library scanner', () => {
	it('turns folders into galleries, sections and photos', async () => {
		await scanner.scanLibrary();
		const all = galleries();
		expect(all).toHaveLength(1);
		const [g] = all;
		expect(g.name).toBe('Wedding');
		expect(g.slug).toBe('wedding');
		expect(g.status).toBe('draft');
		expect(fs.readFileSync(path.join(photos, 'Wedding', '.folio-id'), 'utf8').trim()).toBe(g.id);
		expect(g.warnings.map((w) => w.code).sort()).toEqual(['nestedFolders', 'rootImages', 'unsupportedFiles']);

		const sections = db.getDb().select().from(db.schema.sections).all();
		expect(sections.map((s) => s.folder)).toEqual(['Ceremony']);
		const rows = db.getDb().select().from(db.schema.photos).all();
		expect(rows.map((p) => p.filename).sort()).toEqual(['IMG_10.jpg', 'IMG_2.jpg']);
	});

	it('processes photos into the cache with oriented dimensions and a color', async () => {
		await waitFor(() =>
			db.getDb().select().from(db.schema.photos).all().every((p) => p.status !== 'pending')
		);
		const rows = db.getDb().select().from(db.schema.photos).all();
		for (const p of rows) expect(p.status).toBe('ready');
		const portrait = rows.find((p) => p.filename === 'IMG_2.jpg')!;
		expect([portrait.width, portrait.height]).toEqual([2000, 3000]);
		expect(portrait.color).toMatch(/^#[0-9a-f]{6}$/);
		expect(portrait.placeholder).toMatch(/^data:image\/webp;base64,/);
		const cacheDir = path.join(process.env.CACHE_DIR!, 'photos', portrait.id.slice(0, 2), portrait.id);
		expect(fs.readdirSync(cacheDir).sort()).toEqual(['v1-w1600.webp', 'v1-w2400.webp', 'v1-w480.webp', 'v1-w960.webp']);
	});

	it('keeps settings when the folder is renamed on disk', async () => {
		const [before] = galleries();
		db.getDb().update(db.schema.galleries).set({ status: 'published' }).run();
		fs.renameSync(path.join(photos, 'Wedding'), path.join(photos, 'Wedding 2026'));
		await scanner.scanLibrary();
		const all = galleries();
		expect(all).toHaveLength(1);
		expect(all[0].id).toBe(before.id);
		expect(all[0].folder).toBe('Wedding 2026');
		expect(all[0].status).toBe('published');
		expect(all[0].missing).toBe(false);
		expect(db.getDb().select().from(db.schema.photos).all()).toHaveLength(2);
	});

	it('marks a vanished folder as missing instead of deleting it', async () => {
		const away = path.join(tmp, 'away');
		fs.renameSync(path.join(photos, 'Wedding 2026'), away);
		await scanner.scanLibrary();
		expect(galleries()[0].missing).toBe(true);
		expect(db.getDb().select().from(db.schema.photos).all()).toHaveLength(2);

		fs.renameSync(away, path.join(photos, 'Wedding 2026'));
		await scanner.scanLibrary();
		expect(galleries()[0].missing).toBe(false);
	});

	it('leaves the database alone when the library cannot be read', async () => {
		const moved = `${photos}-offline`;
		fs.renameSync(photos, moved);
		await scanner.scanLibrary();
		expect(scanner.libraryState.available).toBe(false);
		expect(galleries()[0].missing).toBe(false);
		fs.renameSync(moved, photos);
		await scanner.scanLibrary();
		expect(scanner.libraryState.available).toBe(true);
	});

	it('treats a copied folder as a new gallery', async () => {
		fs.cpSync(path.join(photos, 'Wedding 2026'), path.join(photos, 'Wedding copy'), { recursive: true });
		await scanner.scanLibrary();
		const all = galleries();
		expect(all).toHaveLength(2);
		expect(new Set(all.map((g) => g.id)).size).toBe(2);
		const copyId = fs.readFileSync(path.join(photos, 'Wedding copy', '.folio-id'), 'utf8').trim();
		expect(all.find((g) => g.folder === 'Wedding copy')?.id).toBe(copyId);
	});

	it('picks up changed and removed files', async () => {
		const file = path.join(photos, 'Wedding 2026', 'Ceremony', 'IMG_10.jpg');
		await makeJpeg(file, 1200, 800, '#228b22');
		fs.rmSync(path.join(photos, 'Wedding 2026', 'Ceremony', 'IMG_2.jpg'));
		await scanner.scanLibrary();
		const [g] = galleries().filter((x) => x.folder === 'Wedding 2026');
		const rows = db.getDb().select().from(db.schema.photos).all().filter((p) => p.galleryId === g.id);
		expect(rows.map((p) => p.filename)).toEqual(['IMG_10.jpg']);
		expect(rows[0].version).toBe(2);
		await waitFor(() => db.getDb().select().from(db.schema.photos).all().every((p) => p.status !== 'pending'));
		const updated = db.getDb().select().from(db.schema.photos).all().find((p) => p.id === rows[0].id)!;
		expect([updated.width, updated.height]).toEqual([1200, 800]);
	});
});
