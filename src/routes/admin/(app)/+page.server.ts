import { fail, redirect } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { config } from '$lib/server/config';
import { getDb, schema } from '$lib/server/db';
import { processingStats } from '$lib/server/galleries';
import { createGallery, LibraryError } from '$lib/server/library/ops';
import { libraryState, scanLibrary } from '$lib/server/library/scanner';
import { emailCoverPhoto } from '$lib/server/mail/send';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const stats = processingStats();
	const galleries = getDb()
		.select()
		.from(schema.galleries)
		.orderBy(desc(schema.galleries.createdAt))
		.all()
		.map((g) => {
			const cover = emailCoverPhoto(g);
			const s = stats.get(g.id) ?? { total: 0, ready: 0, pending: 0, failed: 0 };
			return {
				id: g.id,
				name: g.name,
				slug: g.slug,
				eventDate: g.eventDate,
				status: g.status,
				missing: g.missing,
				warnings: g.warnings.length + s.failed,
				cover: cover && cover.status === 'ready' ? { id: cover.id, version: cover.version, color: cover.color } : null,
				stats: s
			};
		});
	return {
		galleries,
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
