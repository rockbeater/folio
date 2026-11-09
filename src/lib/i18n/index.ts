import { getContext, setContext } from 'svelte';
import en, { type Messages } from './en';
import da from './da';
import { SUPPORTED_LANGUAGES, type Language } from '$lib/types';

export type MessageKey = keyof Messages;
export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

const catalogs: Record<Language, Messages> = { en, da };

export function isLanguage(value: unknown): value is Language {
	return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function resolveLanguage(value: unknown): Language {
	return isLanguage(value) ? value : 'en';
}

function interpolate(template: string, params?: Params): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in params ? String(params[name]) : match
	);
}

export interface I18n {
	lang: Language;
	t: Translate;
	/** Pick singular/plural message by count: key + `.one` / `.other`. */
	plural: (key: string, count: number, params?: Params) => string;
	formatDate: (value: string | number | Date, style?: 'long' | 'short') => string;
	formatNumber: (value: number) => string;
}

export function createI18n(language: unknown): I18n {
	const lang = resolveLanguage(language);
	const messages = catalogs[lang];
	const t: Translate = (key, params) => interpolate(messages[key] ?? en[key] ?? key, params);
	return {
		lang,
		t,
		plural: (key, count, params) => {
			const rule = new Intl.PluralRules(lang).select(count) === 'one' ? 'one' : 'other';
			const full = `${key}.${rule}` as MessageKey;
			return t(full, { count: new Intl.NumberFormat(lang).format(count), ...params });
		},
		formatDate: (value, style = 'long') => {
			const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
				? new Date(`${value}T12:00:00`)
				: new Date(value);
			if (Number.isNaN(date.getTime())) return '';
			return new Intl.DateTimeFormat(lang, { dateStyle: style === 'long' ? 'long' : 'medium' }).format(date);
		},
		formatNumber: (value) => new Intl.NumberFormat(lang).format(value)
	};
}

const KEY = Symbol('i18n');

export function provideI18n(i18n: I18n): void {
	setContext(KEY, i18n);
}

export function useI18n(): I18n {
	return getContext<I18n>(KEY) ?? createI18n('en');
}
