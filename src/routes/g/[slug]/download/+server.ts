import { error, json } from '@sveltejs/kit';
import { getVisitorId } from '$lib/server/access';
import { loadClientGallery, visitorInfo } from '$lib/server/client';
import { estimateBytes, resolveVariant, singleDownload, zipDownload, type DownloadItem } from '$lib/server/download';
import { getPhotosBySection, getSections } from '$lib/server/galleries';
import { normalizeDownload, type DownloadChoice } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, cookies, locals }) => {
	const isAdmin = Boolean(locals.admin);
	const { gallery, locked } = loadClientGallery(params.slug, { cookies, isAdmin });
	if (locked) error(403);
	const settings = normalizeDownload(gallery.download);
	if (!settings.enabled) error(403, 'downloads-disabled');

	const scope = url.searchParams.get('scope') ?? 'all';
	const size = (url.searchParams.get('size') === 'web' ? 'web' : 'highres') as DownloadChoice;

	const sections = getSections(gallery.id);
	const bySection = getPhotosBySection(gallery.id);
	const ready: DownloadItem[] = sections.flatMap((section) =>
		(bySection.get(section.id) ?? []).filter((p) => p.status === 'ready').map((photo) => ({ photo, section }))
	);

	let items: DownloadItem[];
	let suffix = '';
	if (scope === 'section') {
		const id = url.searchParams.get('section');
		const section = sections.find((s) => s.id === id);
		if (!section) error(404);
		items = ready.filter((i) => i.section.id === section.id);
		suffix = `-${section.slug}`;
	} else if (scope === 'favorites') {
		if (!getVisitorId(cookies, gallery.id)) error(403);
		const favorites = new Set(visitorInfo(cookies, gallery.id).favorites);
		items = ready.filter((i) => favorites.has(i.photo.id));
		suffix = '-favorites';
	} else if (scope === 'photo') {
		const id = url.searchParams.get('photo');
		items = ready.filter((i) => i.photo.id === id);
	} else {
		items = ready;
	}

	if (url.searchParams.has('info')) {
		const high = resolveVariant(settings, 'highres');
		const web = resolveVariant(settings, 'web');
		return json({
			count: items.length,
			highres: high ? Math.round(estimateBytes(items, high)) : 0,
			web: web ? Math.round(estimateBytes(items, web)) : 0
		});
	}

	const variant = resolveVariant(settings, size);
	if (!variant) error(403, 'size-not-allowed');
	if (items.length === 0) error(404);
	if (scope === 'photo') return singleDownload(gallery, items[0], variant);
	return zipDownload(gallery, items, variant, `${gallery.slug}${suffix}.zip`);
};
