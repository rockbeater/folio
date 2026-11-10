import { error, json } from '@sveltejs/kit';
import { config } from '$lib/server/config';
import { getStore } from '$lib/server/settings';
import { handleStripeEvent } from '$lib/server/store/orders';
import { simulatorSecret, verifySignature } from '$lib/server/store/stripe';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/log';

const log = logger('stripe');

/** Stripe webhook. Orders are only marked as paid here, after the signature is verified. */
export const POST: RequestHandler = async ({ request }) => {
	const payload = await request.text();
	const header = request.headers.get('stripe-signature');
	const secret = getStore().stripe.webhookSecret;
	const valid = verifySignature(payload, header, secret) || (config.stripeSimulator && verifySignature(payload, header, simulatorSecret()));
	if (!valid) {
		log.warn(secret ? 'Stripe webhook with an invalid signature was refused' : 'Stripe webhook refused: no signing secret is saved (set the Stripe key up again)');
		error(400, 'invalid-signature');
	}
	let event: { type: string; data: { object: Record<string, unknown> } };
	try {
		event = JSON.parse(payload);
	} catch {
		error(400, 'invalid-payload');
	}
	if (!event?.type || !event.data?.object) error(400, 'invalid-payload');
	handleStripeEvent(event);
	return json({ received: true });
};
