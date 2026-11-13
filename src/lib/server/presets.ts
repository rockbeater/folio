import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from './db';
import type { Gallery, Preset, PresetSettings } from './db/schema';
import { generateGalleryPassword } from './crypto';
import { getPreferences } from './settings';
import { DEFAULT_ACCESS, DEFAULT_DESIGN, DEFAULT_DOWNLOAD, DEFAULT_OPTIONS, normalizeAccess, normalizeDesign, normalizeDownload, normalizeOptions } from '$lib/types';

export function listPresets(): Preset[] {
	return getDb().select().from(schema.presets).orderBy(asc(schema.presets.createdAt)).all();
}

export function getPreset(id: string): Preset | undefined {
	return getDb().select().from(schema.presets).where(eq(schema.presets.id, id)).get();
}

/** Capture a gallery's settings as a preset (the PIN is never copied). */
export function settingsFromGallery(g: Gallery): PresetSettings {
	const created = new Date(g.createdAt);
	const expiryDays = g.expiresOn
		? Math.max(1, Math.round((new Date(`${g.expiresOn}T12:00:00`).getTime() - created.getTime()) / 86_400_000))
		: null;
	return {
		design: normalizeDesign(g.design),
		download: { ...normalizeDownload(g.download), pin: null, sections: null },
		options: normalizeOptions(g.options),
		favoritesEnabled: g.favoritesEnabled,
		language: g.language,
		watermarkId: g.watermarkId,
		expiryDays,
		reminderDays: g.reminderDays,
		access: { ...normalizeAccess(g.access), clientPassword: null, clientSections: [] },
		storeEnabled: g.storeEnabled,
		priceListId: g.priceListId,
		sortMode: g.sortMode
	};
}

export function savePreset(input: { id?: string; name: string; settings: PresetSettings }): string {
	const db = getDb();
	if (input.id && getPreset(input.id)) {
		db.update(schema.presets).set({ name: input.name, settings: input.settings }).where(eq(schema.presets.id, input.id)).run();
		return input.id;
	}
	const id = crypto.randomUUID();
	db.insert(schema.presets).values({ id, name: input.name, settings: input.settings, isDefault: false }).run();
	return id;
}

export function renamePreset(id: string, name: string): void {
	getDb().update(schema.presets).set({ name }).where(eq(schema.presets.id, id)).run();
}

export function setDefaultPreset(id: string | null): void {
	getDb().transaction((tx) => {
		tx.update(schema.presets).set({ isDefault: false }).run();
		if (id) tx.update(schema.presets).set({ isDefault: true }).where(eq(schema.presets.id, id)).run();
	});
}

export function deletePreset(id: string): void {
	getDb().delete(schema.presets).where(eq(schema.presets.id, id)).run();
}

function addDays(days: number): string {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return date.toLocaleDateString('sv-SE');
}

/** Gallery columns for a set of preset settings. */
export function galleryValuesFromSettings(settings: PresetSettings) {
	const access = { ...normalizeAccess(settings.access ?? DEFAULT_ACCESS), clientPassword: null as string | null, clientSections: [] as string[] };
	// Client access in a preset: every gallery gets its own client password (a gallery that
	// already has one keeps it, see the editor's keepClientAccess).
	if (access.clientEnabled) access.clientPassword = generateGalleryPassword();
	return {
		design: normalizeDesign(settings.design ?? DEFAULT_DESIGN),
		download: normalizeDownload({ ...(settings.download ?? DEFAULT_DOWNLOAD), pin: null }),
		options: normalizeOptions(settings.options ?? DEFAULT_OPTIONS),
		favoritesEnabled: settings.favoritesEnabled ?? true,
		language: settings.language ?? getPreferences().defaultLanguage,
		watermarkId: settings.watermarkId ?? null,
		expiresOn: settings.expiryDays ? addDays(settings.expiryDays) : null,
		reminderDays: settings.reminderDays ?? null,
		access,
		storeEnabled: settings.storeEnabled ?? false,
		priceListId: settings.priceListId ?? null,
		// Presets saved before they carried the order leave it as it is.
		sortMode: settings.sortMode === 'date' || settings.sortMode === 'filename' ? settings.sortMode : undefined
	};
}

/** Settings for a brand-new gallery: the default preset, or the built-in defaults. */
export function newGalleryValues() {
	const preset = listPresets().find((p) => p.isDefault);
	return galleryValuesFromSettings(preset?.settings ?? {});
}
