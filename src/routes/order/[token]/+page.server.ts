import { error } from '@sveltejs/kit';
import { galleryWatermarkKey, photosByIds } from '$lib/server/client';
import { getGalleryById, toPhotoView } from '$lib/server/galleries';
import { getStore } from '$lib/server/settings';
import { clearCart } from '$lib/server/store/cart';
import { digitalItems, getOrderByToken, orderItems } from '$lib/server/store/orders';
import { splitIntoParts, resolveVariant } from '$lib/server/download';
import { normalizeDownload } from '$lib/types';
import type { PageServerLoad } from './$types';

/** Receipt: order summary and, once paid, the digital downloads. The token is the secret. */
export const load: PageServerLoad = ({ params, cookies, locals }) => {
	const order = getOrderByToken(params.token);
	if (!order) error(404, 'not-found');
	locals.lang = order.language;
	const gallery = order.galleryId ? getGalleryById(order.galleryId) : undefined;
	const paid = ['paid', 'partially_refunded'].includes(order.paymentStatus);
	if (paid && gallery) clearCart(cookies, gallery.id);

	const items = orderItems(order.id);
	const wmKey = gallery ? galleryWatermarkKey(gallery) : null;
	const photos = gallery ? new Map(photosByIds(gallery.id, items.map((i) => i.photoId).filter((id): id is string => Boolean(id))).map((p) => [p.id, p])) : new Map();
	const download = gallery ? { ...normalizeDownload(gallery.download), enabled: true, highRes: true, web: true } : null;

	return {
		order: {
			number: order.number,
			status: order.status,
			paymentStatus: order.paymentStatus,
			kind: order.kind,
			email: order.email,
			name: order.name,
			address: order.address,
			country: order.country,
			shippingName: order.shippingName,
			currency: order.currency,
			language: order.language,
			subtotal: order.subtotal,
			discount: order.discount,
			shipping: order.shipping,
			tax: order.tax,
			total: order.total,
			refunded: order.refunded,
			tracking: order.tracking,
			createdAt: order.createdAt,
			galleryName: order.galleryName,
			gallerySlug: gallery?.slug ?? null,
			waiting: order.paymentStatus === 'unpaid' && order.status === 'pending'
		},
		items: items.map((i) => {
			const photo = i.photoId ? photos.get(i.photoId) : undefined;
			const files = paid && i.kind === 'digital' ? digitalItems(order, i) : [];
			const variant = download && i.digital ? resolveVariant(download, i.digital.size) : null;
			return {
				id: i.id,
				name: i.productName,
				label: i.variantLabel,
				filename: i.filename,
				kind: i.kind,
				quantity: i.quantity,
				amount: i.unitPrice * i.quantity - i.discount,
				photo: photo ? toPhotoView(photo, wmKey) : null,
				files: files.length,
				parts: variant && files.length > 1 ? splitIntoParts(files, variant).length : 1
			};
		}),
		storeName: getStore().name
	};
};
