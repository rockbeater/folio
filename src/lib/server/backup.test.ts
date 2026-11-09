import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-backup-'));
process.env.PHOTOS_DIR = path.join(tmp, 'photos');
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.CACHE_DIR = path.join(tmp, 'cache');

describe('totp', () => {
	it('matches the RFC 6238 test vector and accepts small clock drift', async () => {
		const { base32Encode, totp, verifyTotp } = await import('./totp');
		const secret = base32Encode(Buffer.from('12345678901234567890'));
		expect(totp(secret, 59_000)).toBe('287082');
		expect(verifyTotp(secret, '287082', 59_000 + 30_000)).toBe(true);
		expect(verifyTotp(secret, '287082', 59_000 + 120_000)).toBe(false);
	});
});

describe('backup', () => {
	it('restores a backup made by Folio and keeps the previous data', async () => {
		const { getDb, schema } = await import('./db');
		const { saveStudio, getStudio } = await import('./settings');
		const { backupResponse, restoreBackup } = await import('./backup');
		getDb();
		saveStudio({ name: 'Before' });
		const zip = Buffer.from(await (await backupResponse()).arrayBuffer());
		saveStudio({ name: 'After' });
		expect(await restoreBackup(zip)).toEqual({ ok: true });
		expect(getStudio().name).toBe('Before');
		expect(getDb().select().from(schema.settings).all().length).toBeGreaterThan(0);
		expect(fs.readdirSync(process.env.DATA_DIR!).some((n) => n.startsWith('.before-restore-'))).toBe(true);
		expect(await restoreBackup(Buffer.from('not a zip'))).toEqual({ ok: false, error: 'invalid' });
	});
});
