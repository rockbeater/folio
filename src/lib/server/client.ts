import type { Cookies } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { getVisitorId, isUnlocked } from './access';
import { getDb, schema } from './db';
import type { Gallery } from './db/schema';
import { getGalleryBySlug, getPhotosBySection, getSections, publicGallery, toPhotoView, toSectionView } from './galleries';
import { getStudio } from './settings';
import { normalizeDesign } from '$lib/types';

export interface ViewerContext {
	cookies: Cookies;
	isAdmin: boolean;
}

/** Load a gallery for a client page, or 404 if the viewer may not see it at all. */
export function loadClientGallery(slug: string, { cookies, isAdmin }: ViewerContext): { gallery: Gallery; locked: boolean } {
	const gallery = getGalleryBySlug(slug);
	if (!gallery) error(404, 'not-found');
	if (!isAdmin && (gallery.status !== 'published' || gallery.missing)) error(404, 'not-found');
	const locked = !isAdmin && !isUnlocked(cookies, gallery);
	return { gallery, locked };
}

export function visitorInfo(cookies: Cookies, galleryId: string): { email: string | null; favorites: string[] } {
	const visitorId = getVisitorId(cookies, galleryId);
	if (!visitorId) return { email: null, favorites: [] };
	const db = getDb();
	const visitor = db
		.select()
		.from(schema.visitors)
		.where(and(eq(schema.visitors.id, visitorId), eq(schema.visitors.galleryId, galleryId)))
		.get();
	if (!visitor) return { email: null, favorites: [] };
	const favorites = db
		.select({ photoId: schema.favorites.photoId })
		.from(schema.favorites)
		.where(eq(schema.favorites.visitorId, visitorId))
		.all()
		.map((f) => f.photoId);
	return { email: visitor.email, favorites };
}

/** Everything the client layout needs: gallery, sections, cover and visitor state. */
export function galleryShell(gallery: Gallery, cookies: Cookies, isAdmin: boolean, designOverride: string | null) {
	const bySection = getPhotosBySection(gallery.id);
	const visibleFor = (sectionId: string) =>
		(bySection.get(sectionId) ?? []).filter((p) => isAdmin || p.status === 'ready');
	const sections = getSections(gallery.id)
		.map((s) => toSectionView(s, visibleFor(s.id).length))
		.filter((s) => s.count > 0 || isAdmin);

	let cover = null;
	const all = [...bySection.values()].flat();
	const coverPhoto =
		all.find((p) => p.id === gallery.coverPhotoId && p.status === 'ready') ?? all.find((p) => p.status === 'ready');
	if (coverPhoto) cover = { ...toPhotoView(coverPhoto), placeholder: coverPhoto.placeholder };

	const pg = publicGallery(gallery);
	if (isAdmin && designOverride) {
		try {
			pg.design = normalizeDesign({ ...pg.design, ...JSON.parse(designOverride) });
		} catch {
			// ignore malformed preview overrides
		}
	}

	const studio = getStudio();
	return {
		gallery: pg,
		sections,
		cover,
		studio: { name: studio.name, logo: studio.logo ? `/branding/${studio.logo}` : null },
		visitor: visitorInfo(cookies, gallery.id),
		isAdmin,
		/** Rendered inside the design preview in the admin. */
		isPreview: isAdmin && Boolean(designOverride),
		pending: all.filter((p) => p.status === 'pending').length
	};
}

/** Ready photos of one section, as client views. */
export function sectionPhotos(gallery: Gallery, sectionId: string, isAdmin: boolean) {
	const photos = getPhotosBySection(gallery.id).get(sectionId) ?? [];
	return photos.filter((p) => isAdmin || p.status === 'ready').map(toPhotoView);
}

export function favoritePhotos(gallery: Gallery, favoriteIds: string[]) {
	if (favoriteIds.length === 0) return [];
	const set = new Set(favoriteIds);
	const out = [];
	for (const photos of getPhotosBySection(gallery.id).values()) {
		for (const p of photos) if (set.has(p.id) && p.status === 'ready') out.push(toPhotoView(p));
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
