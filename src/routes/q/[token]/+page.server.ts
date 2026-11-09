import { error, fail, redirect } from '@sveltejs/kit';
import { addShareGrant, isLinkUnlocked, samePassword, unlockLink } from '$lib/server/access';
import { galleryWatermarkKey, linkPhotoFilter, photosByIds, studioForClients } from '$lib/server/client';
import { getGalleryById, publicGallery, toPhotoView } from '$lib/server/galleries';
import { rateLimit, resetRateLimit } from '$lib/server/ratelimit';
import { countLink, getShareLinkByToken, isLinkOpen } from '$lib/server/shares';
import { normalizeDownload, type DownloadSettings } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

function find(token: string) {
	const link = getShareLinkByToken(token);
	const gallery = link ? getGalleryById(link.galleryId) : undefined;
	if (!link || !gallery || gallery.missing) error(404, 'not-found');
	return { link, gallery };
}

/** Quick share link: only the selected photos, independent of the gallery's password and status. */
export const load: PageServerLoad = ({ params, cookies, locals, url }) => {
	const { link, gallery } = find(params.token);
	locals.lang = gallery.language;
	const isAdmin = Boolean(locals.admin);
	const pg = publicGallery(gallery, 'guest');
	const base = { name: link.name, gallery: pg, studio: studioForClients() };
	if (!isLinkOpen(link) && !isAdmin) return { ...base, state: 'expired' as const, photos: [], download: null };
	if (!isLinkUnlocked(cookies, link) && !isAdmin) return { ...base, state: 'locked' as const, photos: [], download: null };

	addShareGrant(cookies, url, link.id);
	const seen = `fqv_${link.id}`;
	if (!isAdmin && !cookies.get(seen)) {
		countLink(link.id, 'views');
		cookies.set(seen, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
	}
	const wmKey = galleryWatermarkKey(gallery);
	const byId = new Map(photosByIds(gallery.id, link.photoIds).map((p) => [p.id, p]));
	const photos = link.photoIds
		.map((id) => byId.get(id))
		.filter((p) => p && linkPhotoFilter(p))
		.map((p) => toPhotoView(p!, wmKey));
	const gd = normalizeDownload(gallery.download);
	const download: DownloadSettings = {
		...gd,
		enabled: link.download.enabled,
		highRes: link.download.highRes,
		web: link.download.web,
		pin: null,
		requireEmail: false,
		single: true,
		sections: null
	};
	return { ...base, state: 'open' as const, photos, download };
};

export const actions: Actions = {
	default: async ({ params, request, cookies, url, getClientAddress }) => {
		const { link } = find(params.token);
		if (!link.password) redirect(303, url.pathname);
		const key = `link:${getClientAddress()}:${link.id}`;
		if (!rateLimit(key, 10, 15 * 60 * 1000)) return fail(429, { error: 'tooMany' as const });
		const password = String((await request.formData()).get('password') ?? '').trim();
		if (!samePassword(password, link.password)) return fail(400, { error: 'wrong' as const });
		resetRateLimit(key);
		unlockLink(cookies, url, link);
		redirect(303, url.pathname);
	}
};
