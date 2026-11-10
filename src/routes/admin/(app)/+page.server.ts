import { listOrders } from '$lib/server/store/orders';
import { fail, redirect } from '@sveltejs/kit';
import { desc, eq, like } from 'drizzle-orm';
import { config } from '$lib/server/config';
import { getDb, schema } from '$lib/server/db';
import { processingStats } from '$lib/server/galleries';
import { createGallery, LibraryError } from '$lib/server/library/ops';
import { libraryState, scanLibrary } from '$lib/server/library/scanner';
import { emailCoverPhoto } from '$lib/server/mail/send';
import type { Actions, PageServerLoad } from './$types';

const today = () => new Date().toLocaleDateString('sv-SE');

function inDays(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toLocaleDateString('sv-SE');
}

export const load: PageServerLoad = ({ url }) => {
	const db = getDb();
	const stats = processingStats();
	const date = today();
	const rows = db.select().from(schema.galleries).orderBy(desc(schema.galleries.createdAt)).all();
	const galleries = rows.map((g) => {
		const cover = emailCoverPhoto(g);
		const s = stats.get(g.id) ?? { total: 0, ready: 0, pending: 0, failed: 0 };
		return {
			id: g.id,
			name: g.name,
			slug: g.slug,
			eventDate: g.eventDate,
			status: g.status,
			missing: g.missing,
			tags: g.tags,
			expiresOn: g.expiresOn,
			expired: Boolean(g.expiresOn && g.expiresOn < date),
			createdAt: g.createdAt,
			warnings: g.warnings.length + s.failed,
			cover:
				cover && cover.status === 'ready'
					? {
							id: cover.id,
							key: String(cover.version),
							color: cover.color,
							// The focal point belongs to the chosen cover, not to a fallback photo.
							focalX: cover.id === g.coverPhotoId ? g.coverFocalX : 0.5,
							focalY: cover.id === g.coverPhotoId ? g.coverFocalY : 0.5
						}
					: null,
			stats: s
		};
	});

	// Search filenames across the whole library.
	const q = (url.searchParams.get('q') ?? '').trim();
	const results = q
		? db
				.select({
					id: schema.photos.id,
					filename: schema.photos.filename,
					version: schema.photos.version,
					status: schema.photos.status,
					color: schema.photos.color,
					galleryId: schema.photos.galleryId,
					sectionId: schema.photos.sectionId,
					galleryName: schema.galleries.name,
					sectionName: schema.sections.folder
				})
				.from(schema.photos)
				.innerJoin(schema.galleries, eq(schema.galleries.id, schema.photos.galleryId))
				.innerJoin(schema.sections, eq(schema.sections.id, schema.photos.sectionId))
				.where(like(schema.photos.filename, `%${q}%`))
				.limit(120)
				.all()
				.map((r) => ({ ...r, key: String(r.version) }))
		: null;

	const soon = inDays(14);
	const expiring = galleries.filter((g) => g.status === 'published' && g.expiresOn && !g.expired && g.expiresOn <= soon);

	return {
		galleries,
		tags: [...new Set(rows.flatMap((g) => g.tags))].sort((a, b) => a.localeCompare(b)),
		q,
		results,
		expiring,
		newOrders: listOrders({ status: 'processing' }).all.map((o) => ({ id: o.id, number: o.number, name: o.name, total: o.total, currency: o.currency, createdAt: o.createdAt })),
		library: { path: config.photosDir, available: libraryState.available, scanning: libraryState.scanning }
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const date = String(form.get('eventDate') ?? '').trim();
		if (!name) return fail(400, { create: { error: 'admin.galleries.errName', name, date } });
		try {
			const gallery = await createGallery(name, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null);
			redirect(303, `/admin/galleries/${gallery.id}`);
		} catch (err) {
			if (err instanceof LibraryError) {
				const key = err.code === 'exists' ? 'admin.galleries.errExists' : 'admin.galleries.errName';
				return fail(400, { create: { error: key, name, date } });
			}
			throw err;
		}
	},
	scan: async () => {
		await scanLibrary();
		return { scanned: true };
	}
};

