import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { randomToken } from './crypto';
import { getDb, schema } from './db';
import type { FavoriteList, Gallery } from './db/schema';
import { normalizeAccess, type ListView } from '$lib/types';

const DAY = 24 * 60 * 60;

function activeCookie(galleryId: string): string {
	return `fl_${galleryId}`;
}

/** Make sure the visitor has a default list and one list per predefined list of the gallery. */
export function ensureLists(gallery: Pick<Gallery, 'id' | 'access'>, visitorId: string): FavoriteList[] {
	const db = getDb();
	const lists = db
		.select()
		.from(schema.favoriteLists)
		.where(eq(schema.favoriteLists.visitorId, visitorId))
		.orderBy(asc(schema.favoriteLists.createdAt))
		.all();
	const missing: (typeof schema.favoriteLists.$inferInsert)[] = [];
	if (!lists.some((l) => l.name === '' && !l.presetId)) {
		missing.push({ id: crypto.randomUUID(), galleryId: gallery.id, visitorId, name: '' });
	}
	for (const preset of normalizeAccess(gallery.access).lists) {
		if (!lists.some((l) => l.presetId === preset.id)) {
			missing.push({ id: crypto.randomUUID(), galleryId: gallery.id, visitorId, name: preset.name, presetId: preset.id });
		}
	}
	if (missing.length === 0) return lists;
	db.insert(schema.favoriteLists).values(missing).run();
	return ensureLists(gallery, visitorId);
}

/** The visitor's lists with counts, limits and share state. Default list first, then predefined, then own. */
export function listViews(gallery: Pick<Gallery, 'id' | 'access'>, visitorId: string): ListView[] {
	const presets = new Map(normalizeAccess(gallery.access).lists.map((p) => [p.id, p]));
	const lists = ensureLists(gallery, visitorId);
	const counts = new Map(
		getDb()
			.select({ listId: schema.favorites.listId, count: sql<number>`count(*)` })
			.from(schema.favorites)
			.where(eq(schema.favorites.visitorId, visitorId))
			.groupBy(schema.favorites.listId)
			.all()
			.map((c) => [c.listId, c.count])
	);
	const order = (l: FavoriteList) => (l.name === '' && !l.presetId ? 0 : l.presetId && presets.has(l.presetId) ? 1 : 2);
	return [...lists]
		.sort((a, b) => order(a) - order(b))
		.map((l) => {
			const preset = l.presetId ? presets.get(l.presetId) : undefined;
			return {
				id: l.id,
				name: preset?.name ?? l.name,
				limit: preset?.limit ?? null,
				preset: Boolean(preset),
				count: counts.get(l.id) ?? 0,
				submitted: Boolean(l.submittedAt),
				share: l.shareToken ? { token: l.shareToken, private: l.sharePrivate } : null
			};
		});
}

export function getList(visitorId: string, listId: string): FavoriteList | undefined {
	return getDb()
		.select()
		.from(schema.favoriteLists)
		.where(and(eq(schema.favoriteLists.id, listId), eq(schema.favoriteLists.visitorId, visitorId)))
		.get();
}

/** The list the hearts currently add to. Falls back to the default list. */
export function activeListId(cookies: Cookies, gallery: Pick<Gallery, 'id' | 'access'>, visitorId: string): string {
	const lists = ensureLists(gallery, visitorId);
	const wanted = cookies.get(activeCookie(gallery.id));
	return (lists.find((l) => l.id === wanted) ?? lists.find((l) => l.name === '' && !l.presetId) ?? lists[0]).id;
}

export function setActiveList(cookies: Cookies, url: URL, galleryId: string, listId: string): void {
	cookies.set(activeCookie(galleryId), listId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 365 * DAY
	});
}

export function listPhotoIds(listId: string): string[] {
	return getDb()
		.select({ photoId: schema.favorites.photoId })
		.from(schema.favorites)
		.where(eq(schema.favorites.listId, listId))
		.orderBy(asc(schema.favorites.createdAt))
		.all()
		.map((f) => f.photoId);
}

export function listNotes(listId: string): Record<string, string> {
	const notes: Record<string, string> = {};
	for (const f of getDb()
		.select({ photoId: schema.favorites.photoId, note: schema.favorites.note })
		.from(schema.favorites)
		.where(eq(schema.favorites.listId, listId))
		.all()) {
		if (f.note) notes[f.photoId] = f.note;
	}
	return notes;
}

/** Add or remove a photo. Returns false when the list's limit is reached. */
export function setFavorite(gallery: Pick<Gallery, 'access'>, list: FavoriteList, photoId: string, favorite: boolean): boolean {
	const db = getDb();
	if (!favorite) {
		db.delete(schema.favorites).where(and(eq(schema.favorites.listId, list.id), eq(schema.favorites.photoId, photoId))).run();
		return true;
	}
	const preset = list.presetId ? normalizeAccess(gallery.access).lists.find((p) => p.id === list.presetId) : undefined;
	if (preset?.limit) {
		const count = db
			.select({ count: sql<number>`count(*)` })
			.from(schema.favorites)
			.where(eq(schema.favorites.listId, list.id))
			.get()!.count;
		const already = db
			.select({ photoId: schema.favorites.photoId })
			.from(schema.favorites)
			.where(and(eq(schema.favorites.listId, list.id), eq(schema.favorites.photoId, photoId)))
			.get();
		if (!already && count >= preset.limit) return false;
	}
	db.insert(schema.favorites).values({ listId: list.id, visitorId: list.visitorId, photoId }).onConflictDoNothing().run();
	return true;
}

export function setNote(list: FavoriteList, photoId: string, note: string): void {
	getDb()
		.update(schema.favorites)
		.set({ note: note.trim().slice(0, 500) || null })
		.where(and(eq(schema.favorites.listId, list.id), eq(schema.favorites.photoId, photoId)))
		.run();
}

export function createList(gallery: Pick<Gallery, 'id'>, visitorId: string, name: string): string {
	const id = crypto.randomUUID();
	getDb().insert(schema.favoriteLists).values({ id, galleryId: gallery.id, visitorId, name: name.trim().slice(0, 60) }).run();
	return id;
}

export function updateList(list: FavoriteList, values: Partial<Pick<FavoriteList, 'name' | 'submittedAt' | 'shareToken' | 'sharePrivate'>>): void {
	getDb().update(schema.favoriteLists).set(values).where(eq(schema.favoriteLists.id, list.id)).run();
}

export function deleteList(list: FavoriteList): void {
	getDb().delete(schema.favoriteLists).where(eq(schema.favoriteLists.id, list.id)).run();
}

export function newShareToken(): string {
	return randomToken(24);
}

export function getListByToken(token: string): FavoriteList | undefined {
	if (!token || token.length < 20) return undefined;
	return getDb().select().from(schema.favoriteLists).where(eq(schema.favoriteLists.shareToken, token)).get();
}

export function countShare(listId: string, field: 'shareViews' | 'shareDownloads'): void {
	const column = schema.favoriteLists[field];
	getDb()
		.update(schema.favoriteLists)
		.set({ [field]: sql`${column} + 1` })
		.where(eq(schema.favoriteLists.id, listId))
		.run();
}

/** For every photo in any of the visitor's lists: the lists it is in. */
export function memberships(visitorId: string): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const f of getDb()
		.select({ listId: schema.favorites.listId, photoId: schema.favorites.photoId })
		.from(schema.favorites)
		.where(eq(schema.favorites.visitorId, visitorId))
		.all()) {
		(out[f.photoId] ??= []).push(f.listId);
	}
	return out;
}

/** Remove a photo from all of the visitor's lists. */
export function removeEverywhere(visitorId: string, photoId: string): void {
	getDb()
		.delete(schema.favorites)
		.where(and(eq(schema.favorites.visitorId, visitorId), eq(schema.favorites.photoId, photoId)))
		.run();
}
