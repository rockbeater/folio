import { eq } from 'drizzle-orm';
import { getDb, schema } from './db';
import { config } from './config';

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
}

const DEFAULT_PREFERENCES: Preferences = {
	defaultLanguage: 'en',
	banner: { enabled: false, text: '', code: '' }
};

export function getPreferences(): Preferences {
	const stored = read('preferences', DEFAULT_PREFERENCES);
	return { ...stored, banner: { ...DEFAULT_PREFERENCES.banner, ...stored.banner } };
}

export function savePreferences(update: Partial<Preferences>): Preferences {
	const next = { ...getPreferences(), ...update };
	write('preferences', next);
	return next;
}

export function isSmtpConfigured(smtp = getSmtp()): boolean {
	return Boolean(smtp.host && smtp.port && smtp.fromEmail);
}
