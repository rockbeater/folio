import fs from 'node:fs';
import { config } from '../config';
import { scanLibrary } from './scanner';
import { purgeTrash } from './files';

let started = false;

/**
 * Keep the database in sync with the photo library:
 * a file watcher reacts quickly to local changes, and a periodic scan catches
 * everything else (network shares often do not deliver file events).
 */
export function startLibraryWatcher(): void {
	if (started) return;
	started = true;

	let timer: NodeJS.Timeout | null = null;
	const schedule = (delay = 2000) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			void scanLibrary();
		}, delay);
	};

	try {
		const watcher = fs.watch(config.photosDir, { recursive: true }, (_event, filename) => {
			const name = String(filename ?? '');
			if (name.includes('.upload-') || name.endsWith('.tmp')) return;
			schedule();
		});
		watcher.on('error', (err) => {
			console.warn('[folio] file watcher stopped, relying on periodic scans:', err.message);
			watcher.close();
		});
	} catch (err) {
		console.warn('[folio] file watcher unavailable, relying on periodic scans:', (err as Error).message);
	}

	setInterval(() => void scanLibrary(), config.scanIntervalSeconds * 1000).unref();
	setInterval(() => void purgeTrash().catch(() => undefined), 6 * 60 * 60 * 1000).unref();
	void purgeTrash().catch(() => undefined);
}
