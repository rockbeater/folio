import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { getVisitorId, isExpired, isUnlocked, today } from './access';
import { getDb, schema } from './db';
import type { ActivityDetail, ActivityKind, Gallery, Photo } from './db/schema';
import { getGalleryBySlug, getPhotosBySection, getSections, publicGallery, toPhotoView, toSectionView } from './galleries';
import { getPreferences, getStudio } from './settings';
import { getWatermark, watermarkKey } from './watermarks';
import { normalizeDesign, normalizeOptions } from '$lib/types';

export interface ViewerContext {
	cookies: Cookies;
	isAdmin: boolean;
}

export { isExpired, today };

/**
 * What a visitor gets to see:
 * - `expired`: the gallery passed its expiry date
 * - `locked`: the gallery password is needed
 * - `register`: the visitor must enter an email first
 * - `open`: the gallery itself
 */
export type ClientState = 'expired' | 'locked' | 'register' | 'open';

/** Load a gallery for a client page, or 404 if the viewer may not see it at all. */
export function loadClientGallery(slug: string, { cookies, isAdmin }: ViewerContext): { gallery: Gallery; state: ClientState } {
	const gallery = getGalleryBySlug(slug);
	if (!gallery) error(404, 'not-found');
	if (isAdmin) return { gallery, state: 'open' };
	if (gallery.status !== 'published' || gallery.missing) error(404, 'not-found');
	if (isExpired(gallery)) return { gallery, state: 'expired' };
	if (!isUnlocked(cookies, gallery)) return { gallery, state: 'locked' };
	if (normalizeOptions(gallery.options).emailRegistration && !getVisitorId(cookies, gallery.id)) {
		return { gallery, state: 'register' };
	}
	return { gallery, state: 'open' };
}

/** Like loadClientGallery, but fails unless the gallery is open to this viewer. */
export function requireOpenGallery(slug: string, viewer: ViewerContext): Gallery {
	const { gallery, state } = loadClientGallery(slug, viewer);
	if (state !== 'open') error(403, state);
	return gallery;
}

export function visitorInfo(cookies: Cookies, galleryId: string): { id: string | null; email: string | null; favorites: string[] } {
	const visitorId = getVisitorId(cookies, galleryId);
	if (!visitorId) return { id: null, email: null, favorites: [] };
	const db = getDb();
	const visitor = db
		.select()
		.from(schema.visitors)
		.where(and(eq(schema.visitors.id, visitorId), eq(schema.visitors.galleryId, galleryId)))
		.get();
	if (!visitor) return { id: null, email: null, favorites: [] };
	const favorites = db
		.select({ photoId: schema.favorites.photoId })
		.from(schema.favorites)
		.where(eq(schema.favorites.visitorId, visitorId))
		.all()
		.map((f) => f.photoId);
	return { id: visitor.id, email: visitor.email, favorites };
}

export function recordActivity(galleryId: string, kind: ActivityKind, email: string | null, detail: ActivityDetail | null = null): void {
	getDb().insert(schema.activity).values({ id: crypto.randomUUID(), galleryId, kind, email, detail }).run();
}

/** The watermark key clients see for this gallery (null: no watermark). */
export function galleryWatermarkKey(gallery: Pick<Gallery, 'watermarkId'>): string | null {
	return watermarkKey(getWatermark(gallery.watermarkId));
}

/** Photos a client can see: processed and not hidden. */
function visible(p: Photo): boolean {
	return p.status === 'ready' && !p.hidden;
}

/** Everything the client layout needs: gallery, sections, cover and visitor state. */
export function galleryShell(gallery: Gallery, cookies: Cookies, isAdmin: boolean, designOverride: string | null) {
	const wmKey = galleryWatermarkKey(gallery);
	const bySection = getPhotosBySection(gallery.id);
	const sections = getSections(gallery.id)
		.map((s) => toSectionView(s, (bySection.get(s.id) ?? []).filter(visible).length))
		.filter((s) => s.count > 0);

	let cover = null;
	const all = [...bySection.values()].flat();
	const coverPhoto = all.find((p) => p.id === gallery.coverPhotoId && visible(p)) ?? all.find(visible);
	if (coverPhoto) cover = { ...toPhotoView(coverPhoto, wmKey), placeholder: coverPhoto.placeholder };

	const pg = publicGallery(gallery);
	if (isAdmin && designOverride) {
		try {
			pg.design = normalizeDesign({ ...pg.design, ...JSON.parse(designOverride) });
		} catch {
			// ignore malformed preview overrides
		}
	}

	return {
		gallery: pg,
		sections,
		cover,
		visitor: visitorInfo(cookies, gallery.id),
		isAdmin,
		/** Rendered inside the design preview in the admin. */
		isPreview: isAdmin && Boolean(designOverride),
		pending: all.filter((p) => p.status === 'pending' && !p.hidden).length,
		totalPhotos: all.filter(visible).length
	};
}

export function studioForClients() {
	const studio = getStudio();
	return {
		name: studio.name,
		email: studio.email,
		phone: studio.phone,
		website: studio.website,
		logo: studio.logo ? `/branding/${studio.logo}` : null,
		coverLogo: studio.coverLogo ? `/branding/${studio.coverLogo}` : null
	};
}

/** The announcement banner for a gallery, if one is set up and enabled. */
export function bannerFor(gallery: Gallery): { text: string; code: string } | null {
	const { banner } = getPreferences();
	if (!banner.enabled || !banner.text.trim() || !normalizeOptions(gallery.options).banner) return null;
	return { text: banner.text.trim(), code: banner.code.trim() };
}

/** Visible photos of one section, as client views. */
export function sectionPhotos(gallery: Gallery, sectionId: string) {
	const wmKey = galleryWatermarkKey(gallery);
	return (getPhotosBySection(gallery.id).get(sectionId) ?? []).filter(visible).map((p) => toPhotoView(p, wmKey));
}

export function favoritePhotos(gallery: Gallery, favoriteIds: string[]) {
	if (favoriteIds.length === 0) return [];
	const wmKey = galleryWatermarkKey(gallery);
	const set = new Set(favoriteIds);
	const out = [];
	for (const photos of getPhotosBySection(gallery.id).values()) {
		for (const p of photos) if (set.has(p.id) && visible(p)) out.push(toPhotoView(p, wmKey));
	}
	return out;
}

export function photosByIds(galleryId: string, ids: string[]) {
	if (ids.length === 0) return [];
	return getDb()
		.select()
		.from(schema.photos)
		.where(and(eq(schema.photos.galleryId, galleryId), inArray(schema.photos.id, ids)))
		.all();
}

export { visible as isVisibleToClients };
