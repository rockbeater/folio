import { error, json } from '@sveltejs/kit';
import { getGalleryById } from '$lib/server/galleries';
import { manifestFor, resolveVariant, singleDownload, splitIntoParts, zipDownload } from '$lib/server/download';
import { digitalItems, getOrderByToken, orderItems } from '$lib/server/store/orders';
import { normalizeDownload } from '$lib/types';
import type { RequestHandler } from './$types';

/** Purchased digital files, without watermark, in the size the product gives. */
export const GET: RequestHandler = ({ params, url }) => {
	const order = getOrderByToken(params.token);
	if (!order || !['paid', 'partially_refunded'].includes(order.paymentStatus)) error(404);
	const item = orderItems(order.id).find((i) => i.id === params.item);
	const gallery = order.galleryId ? getGalleryById(order.galleryId) : undefined;
	if (!item || !item.digital || !gallery) error(404);
	const files = digitalItems(order, item);
	if (files.length === 0) error(404);
	const variant = resolveVariant({ ...normalizeDownload(gallery.download), enabled: true, highRes: true, web: true }, item.digital.size);
	if (!variant) error(404);
	const fileId = url.searchParams.get('file');
	if (fileId) {
		const one = files.find((f) => f.photo.id === fileId);
		if (!one) error(404);
		return singleDownload(gallery, one, variant, null);
	}
	if (url.searchParams.has('manifest')) return json({ files: manifestFor(files, variant, url) });
	if (files.length === 1) return singleDownload(gallery, files[0], variant, null);
	const parts = splitIntoParts(files, variant);
	const part = Math.min(parts.length, Math.max(1, Number(url.searchParams.get('part')) || 1));
	const base = `${gallery.slug}-order-${order.number}`;
	return zipDownload(gallery, parts[part - 1], variant, parts.length > 1 ? `${base}-part-${part}-of-${parts.length}.zip` : `${base}.zip`, null);
};
