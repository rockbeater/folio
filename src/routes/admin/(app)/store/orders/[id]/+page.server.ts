import { error, fail, redirect } from '@sveltejs/kit';
import { photosByIds } from '$lib/server/client';
import { toPhotoView } from '$lib/server/galleries';
import { deleteOrder, getOrder, orderItems, refundOrder, shipOrder, updateOrder } from '$lib/server/store/orders';
import { ORDER_STATUSES, toMinor, type OrderStatus } from '$lib/store';
import { trackingUrl } from '$lib/carriers';
import { getStore } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const order = getOrder(params.id);
	if (!order) error(404, 'not-found');
	const items = orderItems(order.id);
	const photos = order.galleryId
		? new Map(photosByIds(order.galleryId, items.map((i) => i.photoId).filter((id): id is string => Boolean(id))).map((p) => [p.id, p]))
		: new Map();
	return {
		order,
		items: items.map((i) => ({ ...i, photo: i.photoId && photos.has(i.photoId) ? toPhotoView(photos.get(i.photoId)!) : null })),
		hasPrint: items.some((i) => i.kind === 'physical' && i.photoId),
		carriers: getStore().carriers.map((c) => ({ id: c.id, name: c.name })),
		// Shipped orders keep their carrier; new shipments start with the one used last.
		carrier: order.carrier ?? getStore().lastCarrier,
		trackingLink: trackingUrl(getStore().carriers, order.carrier, order.tracking)
	};
};

function requireOrder(id: string) {
	const order = getOrder(id);
	if (!order) error(404);
	return order;
}

export const actions: Actions = {
	status: async ({ params, request }) => {
		const order = requireOrder(params.id);
		const status = String((await request.formData()).get('status')) as OrderStatus;
		if (!ORDER_STATUSES.includes(status)) return fail(400);
		updateOrder(order, { status });
		return { saved: true };
	},
	ship: async ({ params, request }) => {
		const order = requireOrder(params.id);
		const form = await request.formData();
		shipOrder(order, String(form.get('tracking') ?? '').trim().slice(0, 120), String(form.get('carrier') ?? ''));
		return { saved: true };
	},
	refund: async ({ params, request }) => {
		const order = requireOrder(params.id);
		const amount = toMinor(String((await request.formData()).get('amount') ?? ''), order.currency);
		if (!amount) return fail(400, { refundError: 'amount' });
		const result = await refundOrder(order, amount);
		return result.ok ? { saved: true } : fail(400, { refundError: result.error });
	},
	delete: async ({ params }) => {
		deleteOrder(requireOrder(params.id));
		redirect(303, '/admin/store?tab=orders');
	},

	notes: async ({ params, request }) => {
		const order = requireOrder(params.id);
		updateOrder(order, { notes: String((await request.formData()).get('notes') ?? '').slice(0, 5000) });
		return { saved: true };
	}
};
