import { redirect } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { isExpired, isUnlocked } from '$lib/server/access';
import { galleryWatermarkKey, photoFilter, studioForClients } from '$lib/server/client';
import { getDb, schema } from '$lib/server/db';
import { getPhotosBySection, toPhotoView } from '$lib/server/galleries';
import { getPreferences } from '$lib/server/settings';
import { normalizeAccess } from '$lib/types';
import type { PageServerLoad } from './$types';

/** The public homepage (off by default): galleries marked "Show on homepage", with the studio's contact details. */
export const load: PageServerLoad = ({ locals, cookies }) => {
	const prefs = getPreferences();
	locals.lang = prefs.defaultLanguage;
	const studio = studioForClients();
	if (!prefs.homepage.enabled) {
		if (locals.admin) redirect(303, '/admin');
		return { enabled: false as const, language: prefs.defaultLanguage, studio, homepage: prefs.homepage, galleries: [] };
	}

	const galleries = getDb()
		.select()
		.from(schema.galleries)
		.where(and(eq(schema.galleries.status, 'published'), eq(schema.galleries.missing, false)))
		.orderBy(desc(schema.galleries.eventDate), desc(schema.galleries.createdAt))
		.all()
		.filter((g) => normalizeAccess(g.access).homepage && !isExpired(g))
		.map((g) => {
			const guest = photoFilter(g, 'guest');
			const photos = [...getPhotosBySection(g.id).values()].flat();
			const cover = photos.find((p) => p.id === g.coverPhotoId && guest(p)) ?? photos.find(guest);
			// Password-protected galleries only show a blurred placeholder until they are opened.
			const locked = !isUnlocked(cookies, g);
			return {
				id: g.id,
				name: g.name,
				slug: g.slug,
				eventDate: g.eventDate,
				locked,
				cover: cover && !locked ? toPhotoView(cover, galleryWatermarkKey(g)) : null,
				placeholder: cover?.placeholder ?? null,
				color: cover?.color ?? null
			};
		});

	return { enabled: true as const, language: prefs.defaultLanguage, studio, homepage: prefs.homepage, galleries };
};
