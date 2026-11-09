import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from './db';
import type { Gallery, Photo, Section } from './db/schema';
import { naturalCompare } from '$lib/slug';
import { normalizeDesign, normalizeDownload, normalizeOptions, type PhotoView, type SectionView } from '$lib/types';

export function getGalleryById(id: string): Gallery | undefined {
	return getDb().select().from(schema.galleries).where(eq(schema.galleries.id, id)).get();
}

export function getGalleryBySlug(slug: string): Gallery | undefined {
	return getDb().select().from(schema.galleries).where(eq(schema.galleries.slug, slug)).get();
}

export function getSections(galleryId: string): Section[] {
	return getDb()
		.select()
		.from(schema.sections)
		.where(eq(schema.sections.galleryId, galleryId))
		.orderBy(asc(schema.sections.position), asc(schema.sections.folder))
		.all();
}

export function getSection(galleryId: string, sectionId: string): Section | undefined {
	return getDb()
		.select()
		.from(schema.sections)
		.where(and(eq(schema.sections.galleryId, galleryId), eq(schema.sections.id, sectionId)))
		.get();
}

/** Photos of a section in the section's chosen order. */
export function sortPhotos(photos: Photo[], mode: Section['sortMode']): Photo[] {
	const list = [...photos];
	if (mode === 'manual') return list.sort((a, b) => a.position - b.position || naturalCompare(a.filename, b.filename));
	if (mode === 'date') {
		return list.sort(
			(a, b) =>
				(a.takenAt ?? Number.MAX_SAFE_INTEGER) - (b.takenAt ?? Number.MAX_SAFE_INTEGER) ||
				naturalCompare(a.filename, b.filename)
		);
	}
	return list.sort((a, b) => naturalCompare(a.filename, b.filename));
}

export function getPhotosBySection(galleryId: string): Map<string, Photo[]> {
	const sections = getSections(galleryId);
	const rows = getDb().select().from(schema.photos).where(eq(schema.photos.galleryId, galleryId)).all();
	const bySection = new Map<string, Photo[]>(sections.map((s) => [s.id, []]));
	for (const photo of rows) bySection.get(photo.sectionId)?.push(photo);
	for (const section of sections) bySection.set(section.id, sortPhotos(bySection.get(section.id) ?? [], section.sortMode));
	return bySection;
}

/** Photo as sent to the browser. `wmKey` is the gallery's watermark key for client views. */
export function toPhotoView(p: Photo, wmKey: string | null = null): PhotoView {
	return {
		id: p.id,
		sectionId: p.sectionId,
		filename: p.filename,
		width: p.width || 3,
		height: p.height || 2,
		color: p.color,
		key: wmKey ? `${p.version}-${wmKey}` : String(p.version),
		ready: p.status === 'ready'
	};
}

export function toSectionView(s: Section, count: number): SectionView {
	return { id: s.id, name: s.folder, slug: s.slug, count };
}

export interface ProcessingStats {
	total: number;
	ready: number;
	pending: number;
	failed: number;
}

export function processingStats(galleryId?: string): Map<string, ProcessingStats> {
	const rows = getDb()
		.select({
			galleryId: schema.photos.galleryId,
			status: schema.photos.status,
			count: sql<number>`count(*)`
		})
		.from(schema.photos)
		.where(galleryId ? eq(schema.photos.galleryId, galleryId) : undefined)
		.groupBy(schema.photos.galleryId, schema.photos.status)
		.all();
	const out = new Map<string, ProcessingStats>();
	for (const row of rows) {
		const stats = out.get(row.galleryId) ?? { total: 0, ready: 0, pending: 0, failed: 0 };
		stats.total += row.count;
		if (row.status === 'ready') stats.ready += row.count;
		else if (row.status === 'pending') stats.pending += row.count;
		else stats.failed += row.count;
		out.set(row.galleryId, stats);
	}
	return out;
}

/** Public (client-safe) subset of a gallery. Never includes passwords or the download PIN. */
export function publicGallery(g: Gallery) {
	const download = normalizeDownload(g.download);
	return {
		id: g.id,
		name: g.name,
		slug: g.slug,
		eventDate: g.eventDate,
		status: g.status,
		coverPhotoId: g.coverPhotoId,
		coverFocalX: g.coverFocalX,
		coverFocalY: g.coverFocalY,
		design: normalizeDesign(g.design),
		download: { ...download, pin: null },
		downloadPinRequired: Boolean(download.pin),
		options: normalizeOptions(g.options),
		favoritesEnabled: g.favoritesEnabled,
		language: g.language,
		expiresOn: g.expiresOn,
		hasPassword: Boolean(g.password)
	};
}

export type PublicGallery = ReturnType<typeof publicGallery>;

export function touchGallery(id: string, update: Partial<typeof schema.galleries.$inferInsert>): void {
	getDb()
		.update(schema.galleries)
		.set({ ...update, updatedAt: Date.now() })
		.where(eq(schema.galleries.id, id))
		.run();
}
