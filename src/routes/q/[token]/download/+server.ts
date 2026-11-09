import { error, json } from '@sveltejs/kit';
import { isLinkUnlocked } from '$lib/server/access';
import { linkPhotoFilter } from '$lib/server/client';
import { estimateBytes, resolveVariant, singleDownload, splitIntoParts, zipDownload, type DownloadItem } from '$lib/server/download';
import { getGalleryById, getPhotosBySection, getSections } from '$lib/server/galleries';
import { countLink, getShareLinkByToken, isLinkOpen } from '$lib/server/shares';
import { getWatermark } from '$lib/server/watermarks';
import { normalizeDownload, type DownloadChoice } from '$lib/types';
import type { RequestHandler } from './$types';

/** GET /q/<token>/download?scope=all|photo&size=highres|web[&photo=][&part=][&info=1] */
export const GET: RequestHandler = async ({ params, url, cookies, locals }) => {
	const link = getShareLinkByToken(params.token);
	const gallery = link ? getGalleryById(link.galleryId) : undefined;
	const isAdmin = Boolean(locals.admin);
	if (!link || !gallery || gallery.missing) error(404);
	if (!isAdmin && (!isLinkOpen(link) || !isLinkUnlocked(cookies, link))) error(403);
	if (!link.download.enabled) error(403, 'downloads-disabled');

	const settings = { ...normalizeDownload(gallery.download), highRes: link.download.highRes, web: link.download.web };
	const ids = new Set(link.photoIds);
	const bySection = getPhotosBySection(gallery.id);
	const available: DownloadItem[] = getSections(gallery.id).flatMap((section) =>
		(bySection.get(section.id) ?? []).filter((p) => ids.has(p.id) && linkPhotoFilter(p)).map((photo) => ({ photo, section }))
	);
	const scope = url.searchParams.get('scope') === 'photo' ? 'photo' : 'all';
	const items = scope === 'photo' ? available.filter((i) => i.photo.id === url.searchParams.get('photo')) : available;
	const size = (url.searchParams.get('size') === 'web' ? 'web' : 'highres') as DownloadChoice;

	if (url.searchParams.has('info')) {
		const sizes: Record<string, { bytes: number; parts: number }> = {};
		for (const choice of ['highres', 'web'] as const) {
			const variant = resolveVariant(settings, choice);
			if (variant) sizes[choice] = { bytes: Math.round(estimateBytes(items, variant)), parts: splitIntoParts(items, variant).length };
		}
		return json({ count: items.length, sizes, needsPin: false, needsEmail: false });
	}

	const variant = resolveVariant(settings, size);
	if (!variant) error(403, 'size-not-allowed');
	if (items.length === 0) error(404);
	if (!isAdmin) countLink(link.id, 'downloads');
	const watermark = size === 'web' && settings.watermarkWeb ? (getWatermark(gallery.watermarkId) ?? null) : null;
	if (scope === 'photo') return singleDownload(gallery, items[0], variant, watermark);

	const parts = splitIntoParts(items, variant);
	const part = Math.min(parts.length, Math.max(1, Number(url.searchParams.get('part')) || 1));
	const base = `${gallery.slug}-${link.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photos';
	const name = parts.length > 1 ? `${base}-part-${part}-of-${parts.length}.zip` : `${base}.zip`;
	return zipDownload(gallery, parts[part - 1], variant, name, watermark, new Set(items.map((i) => i.section.id)).size > 1);
};
