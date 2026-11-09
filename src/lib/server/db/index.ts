import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from '../config';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema>;

let instance: { db: DB; sqlite: Database.Database } | null = null;

function migrationsFolder(): string {
	const candidates = [
		process.env.MIGRATIONS_DIR,
		path.resolve('drizzle'),
		path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../drizzle')
	].filter((p): p is string => Boolean(p));
	const found = candidates.find((p) => fs.existsSync(path.join(p, 'meta', '_journal.json')));
	if (!found) throw new Error(`Database migrations not found (looked in ${candidates.join(', ')})`);
	return found;
}

/** Open (and migrate) a database file. Exposed for tests. */
export function openDatabase(file: string): { db: DB; sqlite: Database.Database } {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const sqlite = new Database(file);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');
	sqlite.pragma('synchronous = NORMAL');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: migrationsFolder() });
	return { db, sqlite };
}

export function getDb(): DB {
	if (!instance) instance = openDatabase(path.join(config.dataDir, 'folio.db'));
	return instance.db;
}

/** Swap the database (tests only). */
export function setDbForTests(db: { db: DB; sqlite: Database.Database } | null): void {
	instance = db;
}

export { schema };
