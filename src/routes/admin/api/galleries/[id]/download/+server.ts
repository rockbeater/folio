import { error } from '@sveltejs/kit';
import { singleDownload, zipDownload, type DownloadItem } from '$lib/server/download';
import { getGalleryById, getPhotosBySection, getSections } from '$lib/server/galleries';
import type { RequestHandler } from './$types';

/** Download originals from the admin: all photos, or the photos in `ids` (comma separated). One photo comes as the file itself. */
export const GET: RequestHandler = ({ params, url, locals }) => {
	if (!locals.admin) error(401);
	const gallery = getGalleryById(params.id);
	if (!gallery) error(404);
	const ids = url.searchParams.get('ids');
	const name = (url.searchParams.get('name') ?? '').replace(/[^\w .-]+/g, '-').slice(0, 80);
	const wanted = ids ? new Set(ids.split(',')) : null;
	const bySection = getPhotosBySection(gallery.id);
	const items: DownloadItem[] = getSections(gallery.id).flatMap((section) =>
		(bySection.get(section.id) ?? []).filter((p) => !wanted || wanted.has(p.id)).map((photo) => ({ photo, section }))
	);
	if (items.length === 0) error(404);
	if (ids && items.length === 1) return singleDownload(gallery, items[0], 'original', null);
	return zipDownload(gallery, items, 'original', `${gallery.slug}${name ? `-${name}` : ''}-originals.zip`, null, true);
};
