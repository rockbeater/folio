import { error, fail } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { generateGalleryPassword } from '$lib/server/crypto';
import { config } from '$lib/server/config';
import { getDb, schema } from '$lib/server/db';
import { getGalleryById, getPhotosBySection, getSection, getSections, processingStats, toPhotoView, touchGallery } from '$lib/server/galleries';
import { createSection, LibraryError, renameSection, trashPhotos, trashSection } from '$lib/server/library/ops';
import { queueGalleryEmail, resendEmail, sendGalleryTest } from '$lib/server/mail/send';
import { listTemplates } from '$lib/server/mail/templates';
import { getStudio, isSmtpConfigured } from '$lib/server/settings';
import { slugify } from '$lib/slug';
import {
	HIGH_RES_SIZES,
	normalizeDesign,
	normalizeDownload,
	WEB_SIZES,
	type GalleryStatus,
	type HighResSize,
	type WebSize
} from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireGallery(id: string) {
	const gallery = getGalleryById(id);
	if (!gallery) error(404, 'Gallery not found');
	return gallery;
}

function baseUrlFor(url: URL): string {
	return config.baseUrl || url.origin;
}

export const load: PageServerLoad = ({ params, url }) => {
	const gallery = requireGallery(params.id);
	const db = getDb();
	const bySection = getPhotosBySection(gallery.id);
	const sections = getSections(gallery.id).map((s) => ({
		id: s.id,
		name: s.folder,
		slug: s.slug,
		sortMode: s.sortMode,
		photos: (bySection.get(s.id) ?? []).map((p) => ({ ...toPhotoView(p), status: p.status, error: p.error }))
	}));

	const visitors = db
		.select({
			email: schema.visitors.email,
			filename: schema.photos.filename
		})
		.from(schema.favorites)
		.innerJoin(schema.visitors, eq(schema.visitors.id, schema.favorites.visitorId))
		.innerJoin(schema.photos, eq(schema.photos.id, schema.favorites.photoId))
		.where(eq(schema.visitors.galleryId, gallery.id))
		.all();
	const favoritesByEmail = new Map<string, string[]>();
	for (const row of visitors) favoritesByEmail.set(row.email, [...(favoritesByEmail.get(row.email) ?? []), row.filename]);

	const emailLog = db
		.select({
			id: schema.emailLog.id,
			recipient: schema.emailLog.recipient,
			subject: schema.emailLog.subject,
			status: schema.emailLog.status,
			error: schema.emailLog.error,
			createdAt: schema.emailLog.createdAt,
			sentAt: schema.emailLog.sentAt
		})
		.from(schema.emailLog)
		.where(and(eq(schema.emailLog.galleryId, gallery.id), eq(schema.emailLog.kind, 'gallery')))
		.orderBy(desc(schema.emailLog.createdAt))
		.limit(50)
		.all();

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
			favoritesEnabled: gallery.favoritesEnabled,
			clientName: gallery.clientName,
			clientEmail: gallery.clientEmail,
			warnings: gallery.warnings
		},
		sections,
		stats: processingStats(gallery.id).get(gallery.id) ?? { total: 0, ready: 0, pending: 0, failed: 0 },
		favorites: [...favoritesByEmail.entries()].map(([email, files]) => ({ email, files })),
		templates: listTemplates().map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body, isDefault: t.isDefault })),
		emailLog,
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
		json: <T>(name: string): T | null => {
			try {
				return JSON.parse(String(form.get(name) ?? '')) as T;
			} catch {
				return null;
			}
		}
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
		if (f.has('eventDate')) update.eventDate = /^\d{4}-\d{2}-\d{2}$/.test(f.str('eventDate')) ? f.str('eventDate') : null;
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
		const photoId = f.str('photoId');
		const photo = getDb()
			.select({ id: schema.photos.id })
			.from(schema.photos)
			.where(and(eq(schema.photos.id, photoId), eq(schema.photos.galleryId, gallery.id)))
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
		const db = getDb();
		db.transaction((tx) => {
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
		const db = getDb();
		db.transaction((tx) => {
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
		await trashPhotos(gallery, f.json<string[]>('ids') ?? []);
		return { ok: true };
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
		const taken = getDb()
			.select({ id: schema.galleries.id })
			.from(schema.galleries)
			.where(eq(schema.galleries.slug, slug))
			.get();
		if (taken && taken.id !== gallery.id) return fail(400, { error: 'slugTaken', section: 'general' });
		const clientEmail = f.str('clientEmail');
		if (clientEmail && !EMAIL.test(clientEmail)) return fail(400, { error: 'clientEmail', section: 'general' });
		touchGallery(gallery.id, { slug, clientName: f.str('clientName') || null, clientEmail: clientEmail || null });
		return { ok: true, section: 'general' };
	},

	privacy: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const password = f.str('password').slice(0, 100);
		touchGallery(gallery.id, { password: password || null });
		return { ok: true, section: 'privacy' };
	},

	generatePassword: async ({ params }) => {
		requireGallery(params.id);
		return { generated: generateGalleryPassword() };
	},

	download: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const highResSize = f.str('highResSize') as HighResSize;
		const webSize = f.str('webSize') as WebSize;
		touchGallery(gallery.id, {
			download: normalizeDownload({
				enabled: f.bool('enabled'),
				highRes: f.bool('highRes'),
				highResSize: HIGH_RES_SIZES.includes(highResSize) ? highResSize : undefined,
				web: f.bool('web'),
				webSize: WEB_SIZES.includes(webSize) ? webSize : undefined
			})
		});
		return { ok: true, section: 'download' };
	},

	favorites: async ({ params, request }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		touchGallery(gallery.id, { favoritesEnabled: f.bool('enabled') });
		return { ok: true, section: 'favorites' };
	},

	sendEmail: async ({ params, request, url }) => {
		const gallery = requireGallery(params.id);
		const f = await formOf(request);
		const recipients = [...new Set(f.str('recipients').split(/[,;\s]+/).map((r) => r.trim().toLowerCase()).filter(Boolean))];
		const errors: Record<string, string> = {};
		if (recipients.length === 0 || recipients.some((r) => !EMAIL.test(r))) errors.recipients = 'admin.email.errRecipients';
		if (!f.str('subject')) errors.subject = 'admin.email.errSubject';
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
		queueGalleryEmail(getGalleryById(gallery.id)!, recipients, payload, f.str('templateId') || null);
		return { queued: recipients.length };
	},

	resend: async ({ params, request }) => {
		requireGallery(params.id);
		const f = await formOf(request);
		return resendEmail(f.str('id')) ? { queued: 1 } : fail(404);
	}
};
