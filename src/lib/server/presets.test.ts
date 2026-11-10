import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-presets-'));
process.env.PHOTOS_DIR = path.join(tmp, 'photos');
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.CACHE_DIR = path.join(tmp, 'cache');

let dbm: typeof import('./db');
let presets: typeof import('./presets');
let scanner: typeof import('./library/scanner');
let galleries: typeof import('./galleries');

beforeAll(async () => {
	dbm = await import('./db');
	presets = await import('./presets');
	scanner = await import('./library/scanner');
	galleries = await import('./galleries');
});

describe('presets and photo order', () => {
	it('gives new galleries and their sections the order of the default preset', () => {
		const id = presets.savePreset({ name: 'By date', settings: { sortMode: 'date' } });
		presets.setDefaultPreset(id);
		const gallery = scanner.insertGallery('g-date', 'Wedding', 'Wedding');
		expect(gallery.sortMode).toBe('date');
		expect(scanner.insertSection(gallery.id, 'Ceremony').sortMode).toBe('date');
		expect(presets.settingsFromGallery(galleries.getGalleryById(gallery.id)!).sortMode).toBe('date');
		presets.setDefaultPreset(null);
	});

	it('re-sorts sections when the order changes, but keeps a custom order', () => {
		const gallery = scanner.insertGallery('g-mixed', 'Family', 'Family');
		const a = scanner.insertSection(gallery.id, 'A');
		const b = scanner.insertSection(gallery.id, 'B');
		const { schema } = dbm;
		dbm.getDb().update(schema.sections).set({ sortMode: 'manual' }).where(eq(schema.sections.id, b.id)).run();
		galleries.sortGallery(gallery.id, 'date');
		expect(galleries.getSection(gallery.id, a.id)?.sortMode).toBe('date');
		expect(galleries.getSection(gallery.id, b.id)?.sortMode).toBe('manual');
		expect(scanner.insertSection(gallery.id, 'C').sortMode).toBe('date');
	});

	it('leaves the order alone for presets saved before they carried it', () => {
		expect(presets.galleryValuesFromSettings({}).sortMode).toBeUndefined();
	});
});
