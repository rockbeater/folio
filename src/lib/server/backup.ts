import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import Database from 'better-sqlite3';
import yauzl from 'yauzl';
import yazl from 'yazl';
import { config } from './config';
import { resetAppSecret } from './crypto';
import { closeDb, getDb, getSqlite } from './db';

/** What a backup holds: the database and the files Folio keeps next to it. Photos and the cache are not included. */
const DIRS = ['branding', 'watermarks', 'store'];
const FILES = ['secret.key'];
const DB_FILE = 'folio.db';

function walk(dir: string, base = dir): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		return entry.isDirectory() ? walk(full, base) : [path.relative(base, full)];
	});
}

/** A ZIP of /data with a consistent copy of the database (made with SQLite's backup API). */
export async function backupResponse(): Promise<Response> {
	const tmp = path.join(os.tmpdir(), `folio-backup-${Date.now()}.db`);
	await getSqlite().backup(tmp);
	const zip = new yazl.ZipFile();
	zip.addFile(tmp, DB_FILE);
	for (const name of FILES) {
		const file = path.join(config.dataDir, name);
		if (fs.existsSync(file)) zip.addFile(file, name);
	}
	for (const dir of DIRS) {
		for (const rel of walk(path.join(config.dataDir, dir))) zip.addFile(path.join(config.dataDir, dir, rel), `${dir}/${rel.split(path.sep).join('/')}`);
	}
	zip.end();
	zip.outputStream.on('end', () => fs.rm(tmp, { force: true }, () => undefined));
	const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
	return new Response(Readable.toWeb(zip.outputStream as Readable) as ReadableStream, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="folio-backup-${stamp}.zip"`,
			'cache-control': 'private, no-store'
		}
	});
}

function allowed(name: string): boolean {
	if (name.includes('..') || name.startsWith('/') || name.includes('\\')) return false;
	return name === DB_FILE || FILES.includes(name) || DIRS.some((d) => name.startsWith(`${d}/`));
}

async function extract(buffer: Buffer, target: string): Promise<string[]> {
	const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
		yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, file) => (err ? reject(err) : resolve(file)))
	);
	const names: string[] = [];
	await new Promise<void>((resolve, reject) => {
		zip.on('error', reject);
		zip.on('end', () => resolve());
		zip.on('entry', (entry: yauzl.Entry) => {
			if (entry.fileName.endsWith('/') || !allowed(entry.fileName)) return zip.readEntry();
			const out = path.join(target, entry.fileName);
			fs.mkdirSync(path.dirname(out), { recursive: true });
			zip.openReadStream(entry, (err, stream) => {
				if (err || !stream) return reject(err);
				const file = fs.createWriteStream(out);
				stream.pipe(file);
				file.on('finish', () => {
					names.push(entry.fileName);
					zip.readEntry();
				});
				file.on('error', reject);
			});
		});
		zip.readEntry();
	});
	return names;
}

/**
 * Restore a backup made by Folio. The current files are moved to
 * DATA_DIR/.before-restore-<time> first, so nothing is lost if the backup was the wrong one.
 */
export async function restoreBackup(buffer: Buffer): Promise<{ ok: true } | { ok: false; error: 'invalid' }> {
	const staging = path.join(config.dataDir, `.restore-${Date.now()}`);
	fs.mkdirSync(staging, { recursive: true });
	try {
		const names = await extract(buffer, staging);
		if (!names.includes(DB_FILE)) throw new Error('no database');
		const check = new Database(path.join(staging, DB_FILE), { readonly: true });
		const ok = check.prepare("select count(*) as n from sqlite_master where type = 'table' and name in ('settings', 'galleries', 'users')").get() as { n: number };
		check.close();
		if (ok.n < 3) throw new Error('not a Folio database');
	} catch {
		fs.rmSync(staging, { recursive: true, force: true });
		return { ok: false, error: 'invalid' };
	}

	const previous = path.join(config.dataDir, `.before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}`);
	fs.mkdirSync(previous, { recursive: true });
	closeDb();
	for (const name of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, ...FILES, ...DIRS]) {
		const from = path.join(config.dataDir, name);
		if (fs.existsSync(from)) fs.renameSync(from, path.join(previous, name));
	}
	for (const name of fs.readdirSync(staging)) fs.renameSync(path.join(staging, name), path.join(config.dataDir, name));
	fs.rmSync(staging, { recursive: true, force: true });
	resetAppSecret();
	getDb(); // reopen and run migrations, in case the backup is from an older version
	return { ok: true };
}
