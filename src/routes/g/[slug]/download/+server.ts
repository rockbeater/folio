import { error, json } from '@sveltejs/kit';
import { isPinUnlocked } from '$lib/server/access';
import { photoFilter, recordActivity, requireGalleryOrShare, visitorInfo } from '$lib/server/client';
import {
	estimateBytes,
	resolveVariant,
	singleDownload,
	splitIntoParts,
	zipDownload,
	type DownloadItem
} from '$lib/server/download';
import { getPhotosBySection, getSections } from '$lib/server/galleries';
import { countShare, getList, listPhotoIds } from '$lib/server/lists';
import { getWatermark } from '$lib/server/watermarks';
import { effectiveDownload, normalizeAccess, normalizeDownload, type DownloadChoice } from '$lib/types';
import type { RequestHandler } from './$types';
import { shouldTrack } from '$lib/server/visitors';

/**
 * GET /g/<slug>/download?scope=all|section|favorites|list|photo&size=highres|web[&section=][&photo=][&part=][&share=]
 * With `info=1` it returns counts, estimated sizes and what the visitor still needs (PIN, email).
 * With `share=<token>` (a shared favorite list) only that list's photos can be downloaded, as a guest.
 */
export const GET: RequestHandler = async ({ params, url, cookies, locals }) => {
	const isAdmin = Boolean(locals.admin);
	const { gallery, role, list } = requireGalleryOrShare(params.slug, { cookies, isAdmin }, url.searchParams.get('share'));
	const settings = effectiveDownload(normalizeDownload(gallery.download), normalizeAccess(gallery.access), role);
	if (!settings.enabled) error(403, 'downloads-disabled');

	const scope = url.searchParams.get('scope') ?? 'all';
	const size = (url.searchParams.get('size') === 'web' ? 'web' : 'highres') as DownloadChoice;
	const visitor = visitorInfo(cookies, gallery);

	const canSee = photoFilter(gallery, role);
	const allowedSections = settings.sections ? new Set(settings.sections) : null;
	const sections = getSections(gallery.id).filter((s) => !allowedSections || allowedSections.has(s.id));
	const bySection = getPhotosBySection(gallery.id);
	const available: DownloadItem[] = sections.flatMap((section) =>
		(bySection.get(section.id) ?? []).filter(canSee).map((photo) => ({ photo, section }))
	);

	let items: DownloadItem[];
	let suffix = '';
	if (scope === 'photo') {
		if (!settings.single) error(403, 'single-disabled');
		items = available.filter((i) => i.photo.id === url.searchParams.get('photo'));
		if (list && !listPhotoIds(list.id).includes(items[0]?.photo.id ?? '')) items = [];
	} else if (list) {
		const ids = new Set(listPhotoIds(list.id));
		items = available.filter((i) => ids.has(i.photo.id));
		suffix = '-favorites';
	} else if (scope === 'section') {
		const section = sections.find((s) => s.id === url.searchParams.get('section'));
		if (!section) error(404);
		items = available.filter((i) => i.section.id === section.id);
		suffix = `-${section.slug}`;
	} else if (scope === 'favorites') {
		const favorites = new Set(visitor.favorites);
		items = available.filter((i) => favorites.has(i.photo.id));
		suffix = '-favorites';
	} else if (scope === 'list') {
		const own = visitor.id ? getList(visitor.id, url.searchParams.get('list') ?? '') : undefined;
		if (!own) error(404);
		const ids = new Set(listPhotoIds(own.id));
		items = available.filter((i) => ids.has(i.photo.id));
		suffix = '-favorites';
	} else {
		items = available;
	}

	const needsPin = !isAdmin && !isPinUnlocked(cookies, gallery.id, settings.pin);
	const needsEmail = !isAdmin && settings.requireEmail && !visitor.email;

	if (url.searchParams.has('info')) {
		const sizes: Record<string, { bytes: number; parts: number }> = {};
		for (const choice of ['highres', 'web'] as const) {
			const variant = resolveVariant(settings, choice);
			if (variant) sizes[choice] = { bytes: Math.round(estimateBytes(items, variant)), parts: splitIntoParts(items, variant).length };
		}
		return json({ count: items.length, sizes, needsPin, needsEmail });
	}

	if (needsPin) error(403, 'pin-required');
	if (needsEmail) error(403, 'email-required');
	const variant = resolveVariant(settings, size);
	if (!variant) error(403, 'size-not-allowed');
	if (items.length === 0) error(404);

	const watermark = size === 'web' && settings.watermarkWeb ? (getWatermark(gallery.watermarkId) ?? null) : null;

	if (shouldTrack(locals)) {
		recordActivity(gallery.id, 'download', visitor.email, {
			scope: list ? 'shared' : scope,
			size,
			count: items.length,
			sectionId: scope === 'section' ? (items[0]?.section.id ?? undefined) : undefined,
			photoId: scope === 'photo' ? items[0]?.photo.id : undefined
		});
		if (list) countShare(list.id, 'shareDownloads');
	}

	if (scope === 'photo') return singleDownload(gallery, items[0], variant, watermark);

	const parts = splitIntoParts(items, variant);
	const part = Math.min(parts.length, Math.max(1, Number(url.searchParams.get('part')) || 1));
	const withFolders = new Set(items.map((i) => i.section.id)).size > 1;
	const name = parts.length > 1 ? `${gallery.slug}${suffix}-part-${part}-of-${parts.length}.zip` : `${gallery.slug}${suffix}.zip`;
	return zipDownload(gallery, parts[part - 1], variant, name, watermark, withFolders);
};
