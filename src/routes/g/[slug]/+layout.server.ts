import { eq } from 'drizzle-orm';
import { bannerFor, galleryShell, loadClientGallery, recordActivity, studioForClients } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import { publicGallery } from '$lib/server/galleries';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params, cookies, locals, url }) => {
	const isAdmin = Boolean(locals.admin);
	const { gallery, state } = loadClientGallery(params.slug, { cookies, isAdmin });
	locals.lang = gallery.language;
	const studio = studioForClients();

	if (state !== 'open') {
		// Before the gallery opens, only a tiny blurred placeholder of the cover is shown.
		const cover = gallery.coverPhotoId
			? getDb()
					.select({ placeholder: schema.photos.placeholder, color: schema.photos.color })
					.from(schema.photos)
					.where(eq(schema.photos.id, gallery.coverPhotoId))
					.get()
			: undefined;
		return {
			state,
			gallery: publicGallery(gallery),
			studio,
			sections: [],
			cover: null,
			visitor: { id: null as string | null, email: null as string | null, favorites: [] as string[] },
			isAdmin: false,
			isPreview: false,
			pending: 0,
			totalPhotos: 0,
			banner: null,
			lockedCover: { placeholder: cover?.placeholder ?? null, color: cover?.color ?? null }
		};
	}

	const shell = galleryShell(gallery, cookies, isAdmin, url.searchParams.get('design'));

	// Count one visit per browser session.
	const visitCookie = `fs_${gallery.id}`;
	if (!isAdmin && !cookies.get(visitCookie)) {
		recordActivity(gallery.id, 'visit', shell.visitor.email);
		cookies.set(visitCookie, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
	}

	return { state, ...shell, studio, banner: bannerFor(gallery), lockedCover: null };
};
