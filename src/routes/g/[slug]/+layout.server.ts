import { eq } from 'drizzle-orm';
import { galleryShell, loadClientGallery } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import { publicGallery } from '$lib/server/galleries';
import { getStudio } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params, cookies, locals, url }) => {
	const isAdmin = Boolean(locals.admin);
	const { gallery, locked } = loadClientGallery(params.slug, { cookies, isAdmin });
	locals.lang = gallery.language;

	if (locked) {
		// Only a tiny blurred placeholder of the cover is shown before the password is entered.
		const cover = gallery.coverPhotoId
			? getDb()
					.select({ placeholder: schema.photos.placeholder, color: schema.photos.color })
					.from(schema.photos)
					.where(eq(schema.photos.id, gallery.coverPhotoId))
					.get()
			: undefined;
		const studio = getStudio();
		return {
			locked: true,
			gallery: publicGallery(gallery),
			sections: [],
			cover: null,
			studio: { name: studio.name, logo: null },
			visitor: { email: null, favorites: [] as string[] },
			isAdmin: false,
			isPreview: false,
			pending: 0,
			lockedCover: { placeholder: cover?.placeholder ?? null, color: cover?.color ?? null }
		};
	}

	return {
		locked: false,
		...galleryShell(gallery, cookies, isAdmin, url.searchParams.get('design')),
		lockedCover: null
	};
};
