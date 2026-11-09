import { error } from '@sveltejs/kit';
import { zipDownload, type DownloadItem } from '$lib/server/download';
import { getGalleryById, getPhotosBySection, getSections } from '$lib/server/galleries';
import type { RequestHandler } from './$types';

/** Download originals from the admin: all photos, or the photos in `ids` (comma separated). */
export const GET: RequestHandler = ({ params, url, locals }) => {
	if (!locals.admin) error(401);
	const gallery = getGalleryById(params.id);
	if (!gallery) error(404);
	const ids = url.searchParams.get('ids');
	const wanted = ids ? new Set(ids.split(',')) : null;
	const bySection = getPhotosBySection(gallery.id);
	const items: DownloadItem[] = getSections(gallery.id).flatMap((section) =>
		(bySection.get(section.id) ?? []).filter((p) => !wanted || wanted.has(p.id)).map((photo) => ({ photo, section }))
	);
	if (items.length === 0) error(404);
	return zipDownload(gallery, items, 'original', `${gallery.slug}-originals.zip`, null, true);
};
