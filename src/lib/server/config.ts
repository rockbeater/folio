import path from 'node:path';

function dir(envName: string, devDefault: string): string {
	const value = process.env[envName];
	if (value && value.trim()) return path.resolve(value.trim());
	return path.resolve(devDefault);
}

function int(envName: string, fallback: number): number {
	const value = Number.parseInt(process.env[envName] ?? '', 10);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Runtime configuration from environment variables. In Docker the paths are /photos, /data and /cache. */
export const config = {
	photosDir: dir('PHOTOS_DIR', 'dev-data/photos'),
	dataDir: dir('DATA_DIR', 'dev-data/data'),
	cacheDir: dir('CACHE_DIR', 'dev-data/cache'),
	/** Public address, e.g. https://gallery.example.com. Used in emails. */
	baseUrl: (process.env.BASE_URL ?? process.env.ORIGIN ?? '').replace(/\/+$/, ''),
	scanIntervalSeconds: int('SCAN_INTERVAL_SECONDS', 60),
	processingConcurrency: int('PROCESSING_CONCURRENCY', 2),
	trashRetentionDays: int('TRASH_RETENTION_DAYS', 30),
	smtpFromEnv: Boolean(process.env.SMTP_HOST)
};

export const TRASH_FOLDER = '.trash';
export const ID_FILE = '.folio-id';
