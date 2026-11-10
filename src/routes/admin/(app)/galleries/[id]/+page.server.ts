import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { config } from '$lib/server/config';
import { getDb, schema } from '$lib/server/db';
import type { ActivityDetail, Gallery } from '$lib/server/db/schema';
import { getGalleryById, getPhotosBySection, getSection, getSections, processingStats, toPhotoView, touchGallery } from '$lib/server/galleries';
import {
	copyPhotos,
	createSection,
	LibraryError,
	movePhotos,
	renameSection,
	setPhotosHidden,
	trashGallery,
	trashPhotos,
	trashSection
} from '$lib/server/library/ops';
import { cancelScheduledEmail, queueGalleryEmail, resendEmail, sendGalleryTest } from '$lib/server/mail/send';
import { listTemplates, pickTemplate } from '$lib/server/mail/templates';
import { galleryValuesFromSettings, getPreset, listPresets, savePreset, settingsFromGallery } from '$lib/server/presets';
import { getStore, getStudio, isSmtpConfigured } from '$lib/server/settings';
import { getPriceList, listPriceLists } from '$lib/server/store/catalog';
import { ordersForGallery, photosInOpenOrders } from '$lib/server/store/orders';
import { createShareLink, deleteShareLink, getShareLink, listShareLinks, updateShareLink, type ShareLinkInput } from '$lib/server/shares';
import { listWatermarks } from '$lib/server/watermarks';
import { slugify } from '$lib/slug';
import {
	HIGH_RES_SIZES,
	normalizeAccess,
	normalizeDesign,
	normalizeDownload,
	normalizeOptions,
	SUPPORTED_LANGUAGES,
	WEB_SIZES,
	type GalleryAccess,
	type GalleryStatus,
	type HighResSize,
	type WebSize
} from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireGallery(id: string) {
	const gallery = getGalleryById(id);
	if (!gallery) error(404, 'Gallery not found');
	return gallery;
}

/** Presets and copied settings never replace a gallery's own client password and client sections. */
function keepClientAccess(access: GalleryAccess, gallery: Gallery): GalleryAccess {
	const own = normalizeAccess(gallery.access);
	return { ...access, clientPassword: own.clientPassword, clientSections: own.clientSections };
}

function baseUrlFor(url: URL): string {
	return config.baseUrl || url.origin;
}

function activityFor(gallery: Gallery, sectionNames: Map<string, string>, photoNames: Map<string, string>) {
	const db = getDb();
	const galleryId = gallery.id;
	const counts = db
		.select({ kind: schema.activity.kind, count: sql<number>`count(*)` })
		.from(schema.activity)
		.where(eq(schema.activity.galleryId, galleryId))
		.groupBy(schema.activity.kind)
		.all();
	const count = (kind: string) => counts.find((c) => c.kind === kind)?.count ?? 0;

	const downloads = db
		.select()
		.from(schema.activity)
		.where(and(eq(schema.activity.galleryId, galleryId), eq(schema.activity.kind, 'download')))
		.orderBy(desc(schema.activity.createdAt))
		.limit(200)
		.all()
		.map((a) => {
			const d = (a.detail ?? {}) as ActivityDetail;
			return {
				id: a.id,
				email: a.email,
				scope: d.scope ?? 'all',
				size: d.size ?? 'highres',
				count: d.count ?? 0,
				target: d.photoId ? (photoNames.get(d.photoId) ?? '') : d.sectionId ? (sectionNames.get(d.sectionId) ?? '') : '',
				createdAt: a.createdAt
			};
		});

	const visitors = db
		.select({
			id: schema.visitors.id,
			email: schema.visitors.email,
			createdAt: schema.visitors.createdAt,
			favorites: sql<number>`(select count(*) from ${schema.favorites} where ${schema.favorites.visitorId} = ${schema.visitors.id})`
		})
		.from(schema.visitors)
		.where(eq(schema.visitors.galleryId, galleryId))
		.orderBy(desc(schema.visitors.createdAt))
		.all();
	const downloadsByEmail = new Map<string, number>();
	for (const d of downloads) if (d.email) downloadsByEmail.set(d.email, (downloadsByEmail.get(d.email) ?? 0) + 1);

	// Favorite lists with their photos and notes, per visitor.
	const lists = db
		.select({
			id: schema.favoriteLists.id,
			name: schema.favoriteLists.name,
			presetId: schema.favoriteLists.presetId,
			submittedAt: schema.favoriteLists.submittedAt,
			shareToken: schema.favoriteLists.shareToken,
			sharePrivate: schema.favoriteLists.sharePrivate,
			shareViews: schema.favoriteLists.shareViews,
			shareDownloads: schema.favoriteLists.shareDownloads,
			email: schema.visitors.email
		})
		.from(schema.favoriteLists)
		.innerJoin(schema.visitors, eq(schema.visitors.id, schema.favoriteLists.visitorId))
		.where(eq(schema.favoriteLists.galleryId, gallery.id))
		.orderBy(asc(schema.favoriteLists.createdAt))
		.all();
	const items = new Map<string, { filename: string; note: string | null; photo: ReturnType<typeof toPhotoView> }[]>();
	for (const row of db
		.select({ listId: schema.favorites.listId, photo: schema.photos, note: schema.favorites.note })
		.from(schema.favorites)
		.innerJoin(schema.photos, eq(schema.photos.id, schema.favorites.photoId))
		.innerJoin(schema.favoriteLists, eq(schema.favoriteLists.id, schema.favorites.listId))
		.where(eq(schema.favoriteLists.galleryId, gallery.id))
		.orderBy(asc(schema.favorites.createdAt))
		.all()) {
		items.set(row.listId, [...(items.get(row.listId) ?? []), { filename: row.photo.filename, note: row.note, photo: toPhotoView(row.photo) }]);
	}
	const presetNames = new Map(normalizeAccess(gallery.access).lists.map((p) => [p.id, p.name]));
	const favoriteLists = lists
		.map((l) => ({
			id: l.id,
			email: l.email,
			name: (l.presetId && presetNames.get(l.presetId)) || l.name,
			submittedAt: l.submittedAt,
			items: items.get(l.id) ?? [],
			share: l.shareToken ? { token: l.shareToken, private: l.sharePrivate, views: l.shareViews, downloads: l.shareDownloads } : null
		}))
		.filter((l) => l.items.length > 0 || l.share);

	const allPhotos = [...getPhotosBySection(gallery.id).values()].flat();
	const privatePhotos = allPhotos.filter((p) => p.private).map((p) => ({ id: p.id, filename: p.filename, section: sectionNames.get(p.sectionId) ?? '' }));
	const shareLinks = listShareLinks(gallery.id).map((l) => ({
		id: l.id,
		token: l.token,
		name: l.name,
		count: l.photoIds.length,
		download: l.download,
		expiresOn: l.expiresOn,
		password: l.password,
		active: l.active,
		views: l.views,
		downloads: l.downloads,
		createdAt: l.createdAt
	}));

	// Visits per day for the last 30 days (server time zone), with empty days as 0.
	const DAY = 24 * 60 * 60 * 1000;
	const perDay = new Map(
		db
			.select({ day: sql<string>`date(${schema.activity.createdAt} / 1000, 'unixepoch', 'localtime')`, count: sql<number>`count(*)` })
			.from(schema.activity)
			.where(and(eq(schema.activity.galleryId, galleryId), eq(schema.activity.kind, 'visit'), gte(schema.activity.createdAt, Date.now() - 31 * DAY)))
			.groupBy(sql`1`)
			.all()
			.map((r) => [r.day, r.count])
	);
	const daily = Array.from({ length: 30 }, (_, i) => {
		const day = new Date(Date.now() - (29 - i) * DAY).toLocaleDateString('sv-SE');
		return { day, count: perDay.get(day) ?? 0 };
	});

	// The photos most visitors put in a list.
	const topPhotos = db
		.select({ photo: schema.photos, people: sql<number>`count(distinct ${schema.favorites.visitorId})` })
		.from(schema.favorites)
		.innerJoin(schema.photos, eq(schema.photos.id, schema.favorites.photoId))
		.where(eq(schema.photos.galleryId, galleryId))
		.groupBy(schema.favorites.photoId)
		.orderBy(desc(sql`2`))
		.limit(12)
		.all()
		.map((r) => ({ photo: toPhotoView(r.photo), filename: r.photo.filename, people: r.people }));

	// Latest events: visits, registrations, downloads, lists sent to the photographer.
	const feed = [
		...db
			.select()
			.from(schema.activity)
			.where(eq(schema.activity.galleryId, galleryId))
			.orderBy(desc(schema.activity.createdAt))
			.limit(40)
			.all()
			.map((a) => ({ kind: a.kind as string, email: a.email, at: a.createdAt, detail: (a.detail?.scope as string | undefined) ?? '' })),
		...lists.filter((l) => l.submittedAt).map((l) => ({ kind: 'submitted', email: l.email, at: l.submittedAt!, detail: (l.presetId && presetNames.get(l.presetId)) || l.name }))
	]
		.sort((a, b) => b.at - a.at)
		.slice(0, 40);

	return {
		visits: count('visit'),
		downloadCount: count('download'),
		registrations: count('registration'),
		daily,
		topPhotos,
		feed,
		favoritedPhotos: db
			.select({ n: sql<number>`count(distinct ${schema.favorites.photoId})` })
			.from(schema.favorites)
			.innerJoin(schema.photos, eq(schema.photos.id, schema.favorites.photoId))
			.where(eq(schema.photos.galleryId, galleryId))
			.get()!.n,
		downloads,
		visitors: visitors.map((v) => ({ ...v, downloads: downloadsByEmail.get(v.email) ?? 0 })),
		favoriteLists,
		privatePhotos,
		shareLinks
	};
}

export const load: PageServerLoad = ({ params, url }) => {
	const gallery = requireGallery(params.id);
	const db = getDb();
	const bySection = getPhotosBySection(gallery.id);
	const sectionList = getSections(gallery.id);
	const sections = sectionList.map((s) => ({
		id: s.id,
		name: s.folder,
		slug: s.slug,
		sortMode: s.sortMode,
		photos: (bySection.get(s.id) ?? []).map((p) => ({ ...toPhotoView(p), status: p.status, error: p.error, hidden: p.hidden }))
	}));
	const sectionNames = new Map(sectionList.map((s) => [s.id, s.folder]));
	const photoNames = new Map([...bySection.values()].flat().map((p) => [p.id, p.filename]));

	const emailLog = db
		.select({
			id: schema.emailLog.id,
			kind: schema.emailLog.kind,
			recipient: schema.emailLog.recipient,
			subject: schema.emailLog.subject,
			status: schema.emailLog.status,
			error: schema.emailLog.error,
			scheduledFor: schema.emailLog.scheduledFor,
			createdAt: schema.emailLog.createdAt,
			sentAt: schema.emailLog.sentAt
		})
		.from(schema.emailLog)
		.where(and(eq(schema.emailLog.galleryId, gallery.id), inArray(schema.emailLog.kind, ['gallery', 'reminder'])))
		.orderBy(desc(schema.emailLog.createdAt))
		.limit(50)
		.all()
		.map((e) => ({ ...e, kind: e.kind as 'gallery' | 'reminder' }));

	return {
		gallery: {
			id: gallery.id,
			name: gallery.name,
			folder: gallery.folder,
			slug: gallery.slug,
			eventDate: gallery.eventDate,
			status: gallery.status,
			missing: gallery.missing,
			coverPhotoId: gallery.coverPhotoId,
			coverFocalX: gallery.coverFocalX,
			coverFocalY: gallery.coverFocalY,
			password: gallery.password,
			design: normalizeDesign(gallery.design),
			download: normalizeDownload(gallery.download),
			options: normalizeOptions(gallery.options),
			access: normalizeAccess(gallery.access),
			storeEnabled: gallery.storeEnabled,
			priceListId: gallery.priceListId,
			favoritesEnabled: gallery.favoritesEnabled,
			language: gallery.language,
			clientName: gallery.clientName,
			clientEmail: gallery.clientEmail,
			tags: gallery.tags,
			watermarkId: gallery.watermarkId,
			expiresOn: gallery.expiresOn,
			reminderDays: gallery.reminderDays,
			reminderTo: gallery.reminderTo,
			reminderSentAt: gallery.reminderSentAt,
			warnings: gallery.warnings
		},
		sections,
		stats: processingStats(gallery.id).get(gallery.id) ?? { total: 0, ready: 0, pending: 0, failed: 0 },
		activity: activityFor(gallery, sectionNames, photoNames),
		templates: listTemplates('delivery').map((t) => ({
			id: t.id,
			name: t.name,
			language: t.language,
			subject: t.subject,
			body: t.body,
			isDefault: t.isDefault
		})),
		defaultTemplateId: pickTemplate('delivery', gallery.language)?.id ?? null,
		emailLog,
		presets: listPresets().map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault })),
		watermarks: listWatermarks().map((w) => ({ id: w.id, name: w.name })),
		otherGalleries: db
			.select({ id: schema.galleries.id, name: schema.galleries.name })
			.from(schema.galleries)
			.where(ne(schema.galleries.id, gallery.id))
			.orderBy(desc(schema.galleries.createdAt))
			.all(),
		languages: [...SUPPORTED_LANGUAGES],
		store: {
			enabled: getStore().enabled,
			currency: getStore().currency,
			priceLists: listPriceLists().map((l) => ({ id: l.id, name: l.name, isDefault: l.isDefault })),
			orders: ordersForGallery(gallery.id).map((o) => ({ id: o.id, number: o.number, status: o.status, name: o.name, total: o.total, currency: o.currency, createdAt: o.createdAt }))
		},
		smtpConfigured: isSmtpConfigured(),
		adminEmail: getStudio().email,
		baseUrl: baseUrlFor(url)
	};
};

async function formOf(request: Request) {
	const form = await request.formData();
	return {
		str: (name: string) => String(form.get(name) ?? '').trim(),
		bool: (name: string) => form.get(name) === 'on' || form.get(name) === 'true',
		has: (name: string) => form.has(name),
		all: (name: string) => form.getAll(name).map(String),
		json: <T>(name: string): T | null => {
			try {
				return JSON.parse(String(form.get(name) ?? '')) as T;
			} catch {
				return null;
			}
		}
	};
}

function linkInput(f: Awaited<ReturnType<typeof formOf>>): ShareLinkInput | null {
	const name = f.str('name').slice(0, 100);
	if (!name) return null;
	const expiresOn = f.str('expiresOn');
	return {
		name,
		download: { enabled: f.bool('dlEnabled'), highRes: f.bool('dlHighRes'), web: f.bool('dlWeb') },
		expiresOn: DATE.test(expiresOn) ? expiresOn : null,
		password: f.str('password').slice(0, 100) || null
	};
}

function libraryFail(err: unknown) {
	if (err instanceof LibraryError) return fail(400, { error: err.code === 'exists' ? 'exists' : 'invalid' });
	throw err;
}

export const actions: Actions = {
	meta: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const update: { name?: string; eventDate?: string | null } = {};
		if (f.has('name') && f.str('name')) update.name = f.str('name').slice(0, 200);
		if (f.has('eventDate')) update.eventDate = DATE.test(f.str('eventDate')) ? f.str('eventDate') : null;
		touchGallery(gallery.id, update);
		return { ok: true };
	},

	status: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const status = f.str('status') as GalleryStatus;
		if (!['draft', 'published', 'hidden'].includes(status)) return fail(400);
		touchGallery(gallery.id, {
			status,
			publishedAt: status === 'published' && !gallery.publishedAt ? Date.now() : gallery.publishedAt
		});
		return { ok: true };
	},

	cover: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const photo = getDb()
			.select({ id: schema.photos.id })
			.from(schema.photos)
			.where(and(eq(schema.photos.id, f.str('photoId')), eq(schema.photos.galleryId, gallery.id)))
			.get();
		if (!photo) return fail(400);
		touchGallery(gallery.id, { coverPhotoId: photo.id, coverFocalX: 0.5, coverFocalY: 0.5 });
		return { ok: true };
	},

	focal: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const clamp = (v: string) => Math.min(1, Math.max(0, Number(v) || 0.5));
		touchGallery(gallery.id, { coverFocalX: clamp(f.str('x')), coverFocalY: clamp(f.str('y')) });
		return { ok: true };
	},

	addSection: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		try {
			const section = await createSection(gallery, f.str('name'));
			return { ok: true, sectionId: section.id };
		} catch (err) {
			return libraryFail(err);
		}
	},

	renameSection: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const section = getSection(gallery.id, f.str('id'));
		if (!section) return fail(404);
		try {
			await renameSection(gallery, section, f.str('name'));
			return { ok: true };
		} catch (err) {
			return libraryFail(err);
		}
	},

	deleteSection: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const section = getSection(gallery.id, f.str('id'));
		if (!section) return fail(404);
		await trashSection(gallery, section);
		return { ok: true };
	},

	reorderSections: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const ids = f.json<string[]>('ids') ?? [];
		getDb().transaction((tx) => {
			ids.forEach((id, position) => {
				tx.update(schema.sections)
					.set({ position })
					.where(and(eq(schema.sections.id, id), eq(schema.sections.galleryId, gallery.id)))
					.run();
			});
		});
		return { ok: true };
	},

	sortMode: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const mode = f.str('mode');
		if (!['filename', 'date', 'manual'].includes(mode)) return fail(400);
		const section = getSection(gallery.id, f.str('sectionId'));
		if (!section) return fail(404);
		const db = getDb();
		if (mode === 'manual' && section.sortMode !== 'manual') {
			// Start the custom order from what the client currently sees.
			const current = getPhotosBySection(gallery.id).get(section.id) ?? [];
			db.transaction((tx) => {
				current.forEach((p, position) => tx.update(schema.photos).set({ position }).where(eq(schema.photos.id, p.id)).run());
			});
		}
		db.update(schema.sections)
			.set({ sortMode: mode as 'filename' | 'date' | 'manual' })
			.where(eq(schema.sections.id, section.id))
			.run();
		return { ok: true };
	},

	reorderPhotos: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const ids = f.json<string[]>('ids') ?? [];
		const section = getSection(gallery.id, f.str('sectionId'));
		if (!section) return fail(404);
		getDb().transaction((tx) => {
			tx.update(schema.sections).set({ sortMode: 'manual' }).where(eq(schema.sections.id, section.id)).run();
			ids.forEach((id, position) => {
				tx.update(schema.photos)
					.set({ position })
					.where(and(eq(schema.photos.id, id), eq(schema.photos.sectionId, section.id)))
					.run();
			});
		});
		return { ok: true };
	},

	deletePhotos: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const ids = f.json<string[]>('ids') ?? [];
		// Warn before deleting photos that are part of an order that is not finished.
		const inOrders = photosInOpenOrders(ids);
		if (inOrders.length > 0 && !f.bool('force')) return fail(409, { inOrders: new Set(inOrders).size });
		await trashPhotos(gallery, ids);
		return { ok: true };
	},

	hidePhotos: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		setPhotosHidden(gallery, f.json<string[]>('ids') ?? [], f.bool('hidden'));
		return { ok: true };
	},

	store: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const priceListId = f.str('priceListId');
		touchGallery(gallery.id, { storeEnabled: f.bool('storeEnabled'), priceListId: priceListId && getPriceList(priceListId) ? priceListId : null });
		return { ok: true, section: 'store' };
	},

	unmarkPrivate: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const ids = (await formOf(request)).json<string[]>('ids') ?? [];
		if (ids.length) {
			getDb()
				.update(schema.photos)
				.set({ private: false })
				.where(and(eq(schema.photos.galleryId, gallery.id), inArray(schema.photos.id, ids)))
				.run();
		}
		return { ok: true };
	},

	createLink: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const ids = new Set([...getPhotosBySection(gallery.id).values()].flat().map((p) => p.id));
		const photoIds = (f.json<string[]>('ids') ?? []).filter((id) => ids.has(id));
		if (photoIds.length === 0) return fail(400, { error: 'noPhotos' });
		const input = linkInput(f);
		if (!input) return fail(400, { error: 'linkName' });
		const link = createShareLink(gallery.id, photoIds, input);
		return { ok: true, linkToken: link.token };
	},

	updateLink: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const link = getShareLink(f.str('id'));
		if (!link || link.galleryId !== gallery.id) return fail(404);
		const input = linkInput(f);
		if (!input) return fail(400, { error: 'linkName' });
		updateShareLink(link.id, input);
		return { ok: true };
	},

	toggleLink: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const link = getShareLink(f.str('id'));
		if (!link || link.galleryId !== gallery.id) return fail(404);
		if (f.has('delete')) deleteShareLink(link.id);
		else updateShareLink(link.id, { active: f.bool('active') });
		return { ok: true };
	},

	unshareList: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		getDb()
			.update(schema.favoriteLists)
			.set({ shareToken: null })
			.where(and(eq(schema.favoriteLists.id, f.str('id')), eq(schema.favoriteLists.galleryId, gallery.id)))
			.run();
		return { ok: true };
	},

	movePhotos: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const target = getSection(gallery.id, f.str('sectionId'));
		if (!target) return fail(404);
		const ids = f.json<string[]>('ids') ?? [];
		const count = f.str('mode') === 'copy' ? await copyPhotos(gallery, ids, target) : await movePhotos(gallery, ids, target);
		return { ok: true, count };
	},

	design: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		touchGallery(gallery.id, { design: normalizeDesign({ ...normalizeDesign(gallery.design), ...(f.json('design') ?? {}) }) });
		return { ok: true };
	},

	general: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const slug = slugify(f.str('slug') || gallery.name);
		const taken = getDb().select({ id: schema.galleries.id }).from(schema.galleries).where(eq(schema.galleries.slug, slug)).get();
		if (taken && taken.id !== gallery.id) return fail(400, { error: 'slugTaken', section: 'general' });
		const clientEmail = f.str('clientEmail');
		if (clientEmail && !EMAIL.test(clientEmail)) return fail(400, { error: 'clientEmail', section: 'general' });
		const language = (SUPPORTED_LANGUAGES as readonly string[]).includes(f.str('language')) ? f.str('language') : gallery.language;
		const tags = [...new Set(f.str('tags').split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 20);
		touchGallery(gallery.id, { slug, clientName: f.str('clientName') || null, clientEmail: clientEmail || null, language, tags });
		return { ok: true, section: 'general' };
	},

	options: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		touchGallery(gallery.id, {
			options: normalizeOptions({
				emailRegistration: f.bool('emailRegistration'),
				galleryAssist: f.bool('galleryAssist'),
				slideshow: f.bool('slideshow'),
				showFilenames: f.bool('showFilenames'),
				banner: f.bool('banner')
			})
		});
		return { ok: true, section: 'options' };
	},

	privacy: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const access = normalizeAccess(gallery.access);
		touchGallery(gallery.id, { password: f.str('password').slice(0, 100) || null, access: { ...access, homepage: f.bool('homepage') } });
		return { ok: true, section: 'privacy' };
	},

	clientAccess: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const access = normalizeAccess(gallery.access);
		const sectionIds = new Set(getSections(gallery.id).map((s) => s.id));
		const password = f.str('clientPassword').trim().slice(0, 100) || null;
		const enabled = f.bool('clientEnabled');
		if (enabled && !password) return fail(400, { section: 'client', error: 'clientPassword' });
		if (enabled && password && password === gallery.password) return fail(400, { section: 'client', error: 'samePassword' });
		touchGallery(gallery.id, {
			access: {
				...access,
				clientEnabled: enabled,
				clientPassword: password,
				clientSections: f.all('clientSections').filter((id) => sectionIds.has(id)),
				clientPrivate: f.bool('clientPrivate'),
				clientDownload: f.str('clientDownloadMode') === 'custom'
					? { enabled: f.bool('cdEnabled'), highRes: f.bool('cdHighRes'), web: f.bool('cdWeb') }
					: null
			}
		});
		return { ok: true, section: 'client' };
	},

	watermark: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const id = f.str('watermarkId');
		const exists = id ? listWatermarks().some((w) => w.id === id) : true;
		if (!exists) return fail(400);
		touchGallery(gallery.id, { watermarkId: id || null });
		return { ok: true, section: 'watermark' };
	},

	expiry: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const expiresOn = DATE.test(f.str('expiresOn')) ? f.str('expiresOn') : null;
		const days = Number.parseInt(f.str('reminderDays'), 10);
		const reminderDays = expiresOn && f.bool('reminder') && Number.isFinite(days) && days > 0 ? Math.min(days, 365) : null;
		const reminderTo = f.str('reminderTo') === 'all' ? 'all' : 'client';
		const changed = expiresOn !== gallery.expiresOn || reminderDays !== gallery.reminderDays;
		touchGallery(gallery.id, { expiresOn, reminderDays, reminderTo, ...(changed ? { reminderSentAt: null } : {}) });
		return { ok: true, section: 'expiry' };
	},

	download: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const highResSize = f.str('highResSize') as HighResSize;
		const webSize = f.str('webSize') as WebSize;
		const pin = f.str('pin');
		if (pin && !/^\d{4}$/.test(pin)) return fail(400, { error: 'pin', section: 'download' });
		const sectionIds = new Set(getSections(gallery.id).map((s) => s.id));
		const limit = f.bool('limitSections') ? f.all('sections').filter((id) => sectionIds.has(id)) : null;
		touchGallery(gallery.id, {
			download: normalizeDownload({
				enabled: f.bool('enabled'),
				highRes: f.bool('highRes'),
				highResSize: HIGH_RES_SIZES.includes(highResSize) ? highResSize : undefined,
				web: f.bool('web'),
				webSize: WEB_SIZES.includes(webSize) ? webSize : undefined,
				pin: pin || null,
				requireEmail: f.bool('requireEmail'),
				single: f.bool('single'),
				sections: limit,
				watermarkWeb: f.bool('watermarkWeb')
			})
		});
		return { ok: true, section: 'download' };
	},

	favorites: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const access = normalizeAccess(gallery.access);
		const lists = normalizeAccess({ lists: f.json<unknown[]>('lists') ?? access.lists }).lists.slice(0, 20);
		touchGallery(gallery.id, {
			favoritesEnabled: f.bool('enabled'),
			access: { ...access, listSharing: f.bool('listSharing'), privateShareDefault: f.bool('privateShareDefault'), lists }
		});
		return { ok: true, section: 'favorites' };
	},

	applyPreset: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const preset = getPreset(f.str('presetId'));
		if (!preset) return fail(404);
		const values = galleryValuesFromSettings(preset.settings);
		touchGallery(gallery.id, { ...values, access: keepClientAccess(values.access, gallery), reminderSentAt: null });
		return { ok: true };
	},

	saveAsPreset: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const name = f.str('name');
		if (!name) return fail(400);
		savePreset({ name: name.slice(0, 100), settings: settingsFromGallery(gallery) });
		return { ok: true };
	},

	copySettings: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const source = getGalleryById(f.str('fromId'));
		if (!source) return fail(404);
		const values = galleryValuesFromSettings(settingsFromGallery(source));
		// Keep this gallery's own expiry date; only copy how things look and work.
		touchGallery(gallery.id, { ...values, access: keepClientAccess(values.access, gallery), expiresOn: gallery.expiresOn, reminderSentAt: null });
		return { ok: true };
	},

	deleteGallery: async ({ params }) => {
		const gallery = requireGallery(params.id);
		await trashGallery(gallery);
		redirect(303, '/admin');
	},

	sendEmail: async ({ params, request, url }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const recipients = [...new Set(f.str('recipients').split(/[,;\s]+/).map((r) => r.trim().toLowerCase()).filter(Boolean))];
		const errors: Record<string, string> = {};
		if (recipients.length === 0 || recipients.some((r) => !EMAIL.test(r))) errors.recipients = 'admin.email.errRecipients';
		if (!f.str('subject')) errors.subject = 'admin.email.errSubject';
		const scheduledFor = f.bool('later') && f.str('sendAt') ? new Date(f.str('sendAt')).getTime() : null;
		if (scheduledFor !== null && (!Number.isFinite(scheduledFor) || scheduledFor <= Date.now())) errors.sendAt = 'admin.email.errSendAt';
		if (Object.keys(errors).length > 0) return fail(400, { emailErrors: errors });

		const payload = {
			subject: f.str('subject'),
			body: f.str('body'),
			includePassword: f.bool('includePassword'),
			baseUrl: baseUrlFor(url)
		};

		if (f.str('mode') === 'test') {
			const to = getStudio().email;
			const result = await sendGalleryTest(gallery, to, payload);
			return result.ok ? { testSent: to } : fail(400, { testError: result.error });
		}

		if (f.bool('publish') && gallery.status !== 'published') {
			touchGallery(gallery.id, { status: 'published', publishedAt: gallery.publishedAt ?? Date.now() });
		}
		// Remember the client's email for next time.
		if (!gallery.clientEmail && recipients.length === 1) touchGallery(gallery.id, { clientEmail: recipients[0] });
		queueGalleryEmail(getGalleryById(gallery.id)!, recipients, payload, f.str('templateId') || null, { scheduledFor });
		return { queued: recipients.length, scheduled: scheduledFor !== null };
	},

	cancelEmail: async ({ params, request }) => {
		requireGallery(params.id);
		const f = await formOf(request);
		return cancelScheduledEmail(f.str('id')) ? { ok: true } : fail(404);
	},

	resend: async ({ params, request }) => {
		requireGallery(params.id);
		const f = await formOf(request);
		return resendEmail(f.str('id')) ? { queued: 1 } : fail(404);
	}
};
