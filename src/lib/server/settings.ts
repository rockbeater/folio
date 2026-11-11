import { eq } from 'drizzle-orm';
import { getDb, schema } from './db';
import { config } from './config';
import { DEFAULT_DOWNLOAD_PREFS, normalizeDownloadPrefs, type DownloadPrefs } from '$lib/smart-download';

export interface StudioSettings {
	name: string;
	email: string;
	phone: string;
	website: string;
	/** File name of the uploaded logo inside DATA_DIR/branding, if any. */
	logo: string | null;
	/** Light version of the logo for use on top of cover photos. */
	coverLogo: string | null;
	favicon: string | null;
	/** Language of the admin interface. */
	language: string;
}

export type SmtpSecurity = 'starttls' | 'tls' | 'none';

export interface SmtpSettings {
	host: string;
	port: number;
	security: SmtpSecurity;
	user: string;
	pass: string;
	fromName: string;
	fromEmail: string;
}

const DEFAULT_STUDIO: StudioSettings = {
	name: '',
	email: '',
	phone: '',
	website: '',
	logo: null,
	coverLogo: null,
	favicon: null,
	language: 'en'
};

const DEFAULT_SMTP: SmtpSettings = {
	host: '',
	port: 587,
	security: 'starttls',
	user: '',
	pass: '',
	fromName: '',
	fromEmail: ''
};

function read<T extends object>(key: string, fallback: T): T {
	const row = getDb().select().from(schema.settings).where(eq(schema.settings.key, key)).get();
	return { ...fallback, ...((row?.value as Partial<T>) ?? {}) };
}

function write<T extends object>(key: string, value: T): void {
	getDb()
		.insert(schema.settings)
		.values({ key, value })
		.onConflictDoUpdate({ target: schema.settings.key, set: { value } })
		.run();
}

/** A small stored object for other modules (e.g. when the self-check last emailed an alert). */
export function readSetting<T extends object>(key: string, fallback: T): T {
	return read(key, fallback);
}

export function writeSetting<T extends object>(key: string, value: T): void {
	write(key, value);
}

export function getStudio(): StudioSettings {
	return read('studio', DEFAULT_STUDIO);
}

export function saveStudio(update: Partial<StudioSettings>): StudioSettings {
	const next = { ...getStudio(), ...update };
	write('studio', next);
	return next;
}

function smtpFromEnv(): SmtpSettings {
	const security = process.env.SMTP_SECURITY;
	return {
		host: process.env.SMTP_HOST ?? '',
		port: Number(process.env.SMTP_PORT) || 587,
		security: security === 'tls' || security === 'none' ? security : 'starttls',
		user: process.env.SMTP_USER ?? '',
		pass: process.env.SMTP_PASS ?? '',
		fromName: process.env.SMTP_FROM_NAME ?? '',
		fromEmail: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? ''
	};
}

/** SMTP settings: environment variables win over settings saved in the admin. */
export function getSmtp(): SmtpSettings {
	return config.smtpFromEnv ? smtpFromEnv() : read('smtp', DEFAULT_SMTP);
}

export function saveSmtp(update: Partial<SmtpSettings>): SmtpSettings {
	const next = { ...read('smtp', DEFAULT_SMTP), ...update };
	write('smtp', next);
	return next;
}

export interface Preferences {
	/** Language of new galleries. */
	defaultLanguage: string;
	/** Announcement banner shown at the top of galleries (each gallery can turn it off). */
	banner: { enabled: boolean; text: string; code: string };
	/** Public homepage listing the galleries marked "Show on homepage". Off by default. */
	homepage: { enabled: boolean; title: string; intro: string; links: string[] };
	/** Search engines may index nothing (default) or only the homepage. Galleries are never indexed. */
	searchVisibility: 'none' | 'homepage';
	/** Sharpening of display copies; originals are never changed. */
	sharpening: 'none' | 'standard' | 'optimal';
	/** Leave out visits and downloads from IP addresses the admin has used. */
	ignoreAdminIps: boolean;
	/** How photos are saved on each kind of device (smart downloads). */
	downloads: DownloadPrefs;
}

const DEFAULT_PREFERENCES: Preferences = {
	defaultLanguage: 'en',
	banner: { enabled: false, text: '', code: '' },
	homepage: { enabled: false, title: '', intro: '', links: [] },
	searchVisibility: 'none',
	sharpening: 'standard',
	ignoreAdminIps: true,
	downloads: DEFAULT_DOWNLOAD_PREFS
};

export function getPreferences(): Preferences {
	const stored = read('preferences', DEFAULT_PREFERENCES);
	return {
		...DEFAULT_PREFERENCES,
		...stored,
		banner: { ...DEFAULT_PREFERENCES.banner, ...stored.banner },
		homepage: { ...DEFAULT_PREFERENCES.homepage, ...stored.homepage },
		downloads: normalizeDownloadPrefs(stored.downloads)
	};
}

let sharpeningCache: Preferences['sharpening'] | null = null;

/** Read on every image request, so it is cached until the preferences change. */
export function sharpening(): Preferences['sharpening'] {
	sharpeningCache ??= getPreferences().sharpening;
	return sharpeningCache;
}

export function savePreferences(update: Partial<Preferences>): Preferences {
	const next = { ...getPreferences(), ...update };
	sharpeningCache = null;
	write('preferences', next);
	return next;
}

/** When the owner last looked at the activity (the bell): newer items are marked as new. */
export function getActivitySeenAt(): number {
	return read('activitySeen', { at: 0 }).at;
}

export function setActivitySeenAt(at: number): void {
	write('activitySeen', { at });
}

export function isSmtpConfigured(smtp = getSmtp()): boolean {
	return Boolean(smtp.host && smtp.port && smtp.fromEmail);
}

export interface StripeSettings {
	/** Secret or restricted key. Never sent to the browser. */
	secretKey: string;
	mode: 'test' | 'live' | null;
	accountName: string;
	webhookId: string;
	webhookSecret: string;
	webhookUrl: string;
	lastWebhookAt: number | null;
	error: string;
}

export interface StoreSettings {
	/** Global switch for the store in all galleries. */
	enabled: boolean;
	name: string;
	email: string;
	/** ISO 4217 code, chosen when the store is set up. */
	currency: string;
	terms: string;
	license: string;
	/** Address of this site as last seen at checkout (for links in store emails without BASE_URL). */
	siteUrl: string;
	stripe: StripeSettings;
}

const DEFAULT_STRIPE: StripeSettings = {
	secretKey: '',
	mode: null,
	accountName: '',
	webhookId: '',
	webhookSecret: '',
	webhookUrl: '',
	lastWebhookAt: null,
	error: ''
};

const DEFAULT_STORE: StoreSettings = {
	enabled: false,
	name: '',
	email: '',
	currency: 'EUR',
	terms: '',
	license: '',
	siteUrl: '',
	stripe: DEFAULT_STRIPE
};

export function getStore(): StoreSettings {
	const stored = read('store', DEFAULT_STORE);
	return { ...stored, stripe: { ...DEFAULT_STRIPE, ...stored.stripe } };
}

export function saveStore(update: Partial<Omit<StoreSettings, 'stripe'>> & { stripe?: Partial<StripeSettings> }): StoreSettings {
	const current = getStore();
	const next = { ...current, ...update, stripe: { ...current.stripe, ...update.stripe } };
	write('store', next);
	return next;
}

/** IP addresses the admin has been seen on, with the time last seen (ms). */
export function getAdminIps(): Record<string, number> {
	return read<Record<string, number>>('adminIps', {});
}

export function saveAdminIps(ips: Record<string, number>): void {
	write('adminIps', ips);
}
