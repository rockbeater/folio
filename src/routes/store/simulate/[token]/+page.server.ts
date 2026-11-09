import { error, redirect } from '@sveltejs/kit';
import { config } from '$lib/server/config';
import { getStore } from '$lib/server/settings';
import { getOrderByToken, handleStripeEvent } from '$lib/server/store/orders';
import { signatureHeader, simulatorSecret, verifySignature } from '$lib/server/store/stripe';
import type { Actions, PageServerLoad } from './$types';

/**
 * Payment simulator, used when no Stripe key is set up (development and demos only).
 * It builds the same signed webhook events Stripe would send and runs them through the
 * webhook handler, so the whole order flow can be tried without a Stripe account.
 */
function find(token: string) {
	if (!config.stripeSimulator) error(404, 'not-found');
	const order = getOrderByToken(token);
	if (!order || order.stripeMode !== 'simulated') error(404, 'not-found');
	return order;
}

export const load: PageServerLoad = ({ params }) => {
	const order = find(params.token);
	return {
		number: order.number,
		total: order.total,
		currency: order.currency,
		language: order.language,
		email: order.email,
		status: order.paymentStatus,
		storeName: getStore().name
	};
};

function deliver(type: string, order: ReturnType<typeof find>, extra: Record<string, unknown> = {}) {
	const payload = JSON.stringify({
		id: `evt_sim_${Date.now()}`,
		type,
		data: {
			object: {
				id: order.stripeSessionId,
				client_reference_id: order.id,
				metadata: { order_id: order.id },
				payment_intent: `pi_sim_${order.id.slice(0, 8)}`,
				...extra
			}
		}
	});
	// Same check as the real webhook endpoint.
	const header = signatureHeader(payload, simulatorSecret());
	if (!verifySignature(payload, header, simulatorSecret())) error(500);
	handleStripeEvent(JSON.parse(payload));
}

export const actions: Actions = {
	pay: ({ params }) => {
		const order = find(params.token);
		deliver('checkout.session.completed', order, { payment_status: 'paid' });
		redirect(303, `/order/${order.token}`);
	},
	cancel: ({ params }) => {
		const order = find(params.token);
		deliver('checkout.session.expired', order, { payment_status: 'unpaid' });
		redirect(303, order.galleryId ? `/order/${order.token}` : '/');
	}
};
