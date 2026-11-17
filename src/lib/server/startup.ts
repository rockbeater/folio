import fs from 'node:fs';
import { config } from './config';
import { getDb } from './db';
import { hasAdmin, purgeExpiredSessions } from './auth';
import { setupCode } from './setup';
import { resumePending } from './images/queue';
import { scanLibrary } from './library/scanner';
import { startLibraryWatcher } from './library/watcher';
import { ensureDefaultTemplates } from './mail/templates';
import { startMailQueue } from './mail/send';
import { getStudio } from './settings';
import { startHealthChecks } from './health';
import { purgeAbandonedCheckouts } from './store/orders';

let started = false;

/** Start background services once per process. */
export function startServices(): void {
	if (started) return;
	started = true;

	for (const dir of [config.dataDir, config.cacheDir, config.photosDir]) {
		fs.mkdirSync(dir, { recursive: true });
	}
	getDb(); // opens and migrates the database
	purgeExpiredSessions();
	ensureDefaultTemplates(getStudio().language);
	if (!hasAdmin()) setupCode(); // prints the one-time setup code in the log

	console.log(`[folio] photo library: ${config.photosDir}`);
	console.log(`[folio] data: ${config.dataDir}, cache: ${config.cacheDir}`);

	resumePending();
	void scanLibrary().then(() => console.log('[folio] library scan complete'));
	startLibraryWatcher();
	startMailQueue();
	purgeAbandonedCheckouts();
	setInterval(purgeAbandonedCheckouts, 6 * 60 * 60 * 1000).unref();
	startHealthChecks();
}
