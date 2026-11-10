// Smart downloads: how photos are saved on each kind of device.
// The photographer picks a method per device under Settings → Preferences; these are the defaults.

export const DEVICE_KINDS = ['iphone', 'ipad', 'android', 'chromium', 'safari', 'other'] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/**
 * - share: the share sheet ("Save images" puts them straight into Photos), in batches
 * - folder: the visitor picks a folder and the photos are written into it (Chrome/Edge on a computer)
 * - files: one download per photo
 * - zip: one ZIP file (split into parts when very large)
 */
export const DOWNLOAD_METHODS = ['share', 'folder', 'files', 'zip'] as const;
export type DownloadMethod = (typeof DOWNLOAD_METHODS)[number];

export interface DownloadPrefs {
	methods: Record<DeviceKind, DownloadMethod>;
	/** Photos per share-sheet batch: phones keep the whole batch in memory. */
	batch: number;
}

export const RECOMMENDED_METHODS: Record<DeviceKind, DownloadMethod> = {
	iphone: 'share',
	ipad: 'share',
	android: 'files',
	chromium: 'folder',
	safari: 'zip',
	other: 'zip'
};

/** The methods that make sense to offer for each device. */
export const METHODS_FOR: Record<DeviceKind, DownloadMethod[]> = {
	iphone: ['share', 'zip', 'files'],
	ipad: ['share', 'zip', 'files'],
	android: ['files', 'share', 'zip'],
	chromium: ['folder', 'zip', 'files'],
	safari: ['zip', 'share', 'files'],
	other: ['zip', 'files']
};

export const DEFAULT_BATCH = 20;

export const DEFAULT_DOWNLOAD_PREFS: DownloadPrefs = { methods: { ...RECOMMENDED_METHODS }, batch: DEFAULT_BATCH };

export function normalizeDownloadPrefs(input: unknown): DownloadPrefs {
	const d = (input && typeof input === 'object' ? input : {}) as { methods?: Record<string, unknown>; batch?: unknown };
	const methods = { ...RECOMMENDED_METHODS };
	for (const kind of DEVICE_KINDS) {
		const m = d.methods?.[kind];
		if (typeof m === 'string' && (METHODS_FOR[kind] as string[]).includes(m)) methods[kind] = m as DownloadMethod;
	}
	const batch = Math.floor(Number(d.batch));
	return { methods, batch: Number.isFinite(batch) && batch >= 1 ? Math.min(200, batch) : DEFAULT_BATCH };
}

/** One file of a download, as listed by the server. */
export interface ManifestFile {
	url: string;
	name: string;
	bytes: number;
}

// --- In the browser ---------------------------------------------------------

export function detectDevice(): DeviceKind {
	const ua = navigator.userAgent;
	if (/iPhone|iPod/.test(ua)) return 'iphone';
	// iPads ask for the desktop site and say "Macintosh"; touch support gives them away.
	if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ipad';
	if (/Android/.test(ua)) return 'android';
	if (/Firefox\//.test(ua)) return 'other';
	if (/Chrome\/|Chromium\/|Edg\//.test(ua)) return 'chromium';
	if (/Safari\//.test(ua)) return 'safari';
	return 'other';
}

export function canShareFiles(): boolean {
	try {
		return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'test.jpg', { type: 'image/jpeg' })] });
	} catch {
		return false;
	}
}

export function canPickFolder(): boolean {
	return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/** The method for this browser, falling back when the chosen one is not supported here. */
export function resolveMethod(prefs: DownloadPrefs, device = detectDevice()): DownloadMethod {
	const wanted = prefs.methods[device] ?? RECOMMENDED_METHODS[device];
	if (wanted === 'share' && !canShareFiles()) return device === 'android' ? 'files' : 'zip';
	if (wanted === 'folder' && !canPickFolder()) return 'zip';
	return wanted;
}

/** Split a list into batches of at most `size`. */
export function batches<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}
