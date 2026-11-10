import crypto from 'node:crypto';
import { sign } from '../crypto';
import { getStore, saveStore } from '../settings';
import { logger } from '../log';

const log = logger('stripe');

/**
 * Minimal Stripe client over the REST API (no SDK). Folio uses Checkout Sessions,
 * webhook endpoints and refunds, so a restricted key with those permissions is enough.
 */

const API = 'https://api.stripe.com/v1';

export const WEBHOOK_EVENTS = [
	'checkout.session.completed',
	'checkout.session.async_payment_succeeded',
	'checkout.session.async_payment_failed',
	'checkout.session.expired',
	'charge.refunded'
] as const;

export class StripeError extends Error {
	constructor(
		message: string,
		public status: number,
		public code: string
	) {
		super(message);
	}
}

type Params = Record<string, unknown>;

/** Stripe's form encoding: nested objects as a[b], arrays as a[0][b]. */
export function encode(params: Params, prefix = '', out = new URLSearchParams()): URLSearchParams {
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) continue;
		const name = prefix ? `${prefix}[${key}]` : key;
		if (Array.isArray(value)) {
			value.forEach((item, i) => {
				if (item !== null && typeof item === 'object') encode(item as Params, `${name}[${i}]`, out);
				else out.append(`${name}[${i}]`, String(item));
			});
		} else if (typeof value === 'object') encode(value as Params, name, out);
		else out.append(name, String(value));
	}
	return out;
}

async function call<T>(key: string, method: 'GET' | 'POST' | 'DELETE', path: string, params?: Params): Promise<T> {
	const body = params && method !== 'GET' ? encode(params) : undefined;
	const query = params && method === 'GET' ? `?${encode(params)}` : '';
	const res = await fetch(`${API}${path}${query}`, {
		method,
		headers: {
			authorization: `Bearer ${key}`,
			...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
			'stripe-version': '2024-06-20'
		},
		body
	});
	const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string; type?: string } };
	if (!res.ok) log.warn(`Stripe ${method} ${path} failed (${res.status})`, data.error?.message ?? '');
	if (!res.ok) throw new StripeError(data.error?.message ?? `Stripe error ${res.status}`, res.status, data.error?.code ?? data.error?.type ?? '');
	return data as T;
}

export function keyMode(key: string): 'test' | 'live' | null {
	const m = /^(sk|rk)_(test|live)_/.exec(key.trim());
	return m ? (m[2] as 'test' | 'live') : null;
}

/** Check a key and find the account name. Restricted keys may not read the account; that is fine. */
export async function verifyKey(key: string): Promise<{ mode: 'test' | 'live'; accountName: string }> {
	const mode = keyMode(key);
	if (!mode) throw new StripeError('The key must start with sk_ or rk_', 400, 'invalid_key');
	try {
		const account = await call<{ business_profile?: { name?: string }; settings?: { dashboard?: { display_name?: string } }; email?: string }>(key, 'GET', '/account');
		return { mode, accountName: account.settings?.dashboard?.display_name || account.business_profile?.name || account.email || '' };
	} catch (err) {
		if (!(err instanceof StripeError) || err.status !== 403) throw err;
		await call(key, 'GET', '/webhook_endpoints', { limit: 1 });
		return { mode, accountName: '' };
	}
}

/**
 * Create the webhook endpoint for this installation. The signing secret is only returned
 * when an endpoint is created, so if it is missing (or the URL changed) the old endpoint
 * is deleted and a new one is created.
 */
export async function ensureWebhook(baseUrl: string): Promise<void> {
	const store = getStore();
	const key = store.stripe.secretKey;
	if (!key) return;
	const url = `${baseUrl}/api/stripe/webhook`;
	if (store.stripe.webhookId && store.stripe.webhookSecret && store.stripe.webhookUrl === url) return;
	if (store.stripe.webhookId) {
		await call(key, 'DELETE', `/webhook_endpoints/${store.stripe.webhookId}`).catch(() => undefined);
	}
	const endpoint = await call<{ id: string; secret: string }>(key, 'POST', '/webhook_endpoints', {
		url,
		enabled_events: [...WEBHOOK_EVENTS],
		description: 'Folio'
	}).catch((err: Error) => {
		log.error(`webhook endpoint for ${url} could not be created`, err.message);
		throw err;
	});
	saveStore({ stripe: { webhookId: endpoint.id, webhookSecret: endpoint.secret, webhookUrl: url } });
	log.info(`webhook endpoint created: ${url}`);
}

export async function removeWebhook(): Promise<void> {
	const { stripe } = getStore();
	if (stripe.secretKey && stripe.webhookId) {
		await call(stripe.secretKey, 'DELETE', `/webhook_endpoints/${stripe.webhookId}`).catch(() => undefined);
	}
	saveStore({ stripe: { webhookId: '', webhookSecret: '', webhookUrl: '' } });
}

export interface CheckoutLine {
	name: string;
	amount: number;
	quantity: number;
}

export async function createCheckoutSession(input: {
	orderId: string;
	email: string;
	currency: string;
	lines: CheckoutLine[];
	shipping: { name: string; amount: number } | null;
	successUrl: string;
	cancelUrl: string;
	locale: string;
}): Promise<{ id: string; url: string }> {
	const key = getStore().stripe.secretKey;
	const currency = input.currency.toLowerCase();
	// Payment methods are not listed: Checkout shows those enabled in the Stripe dashboard.
	return call<{ id: string; url: string }>(key, 'POST', '/checkout/sessions', {
		mode: 'payment',
		customer_email: input.email,
		client_reference_id: input.orderId,
		metadata: { order_id: input.orderId },
		payment_intent_data: { metadata: { order_id: input.orderId } },
		success_url: input.successUrl,
		cancel_url: input.cancelUrl,
		locale: input.locale,
		line_items: input.lines.map((l) => ({
			quantity: l.quantity,
			price_data: { currency, unit_amount: l.amount, product_data: { name: l.name.slice(0, 250) } }
		})),
		shipping_options: input.shipping
			? [{ shipping_rate_data: { type: 'fixed_amount', display_name: input.shipping.name.slice(0, 100), fixed_amount: { amount: input.shipping.amount, currency } } }]
			: undefined
	});
}

export async function createRefund(paymentIntent: string, amount: number): Promise<{ id: string; amount: number }> {
	return call(getStore().stripe.secretKey, 'POST', '/refunds', { payment_intent: paymentIntent, amount });
}

// --- Webhook signatures ---------------------------------------------------

function hmac(secret: string, payload: string): string {
	return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/** The Stripe-Signature header for a payload (used by the simulator and tests). */
export function signatureHeader(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
	return `t=${timestamp},v1=${hmac(secret, `${timestamp}.${payload}`)}`;
}

/** Verify a Stripe-Signature header: HMAC-SHA256 of "timestamp.payload", within 5 minutes. */
export function verifySignature(payload: string, header: string | null, secret: string, toleranceSeconds = 300, now = Date.now()): boolean {
	if (!header || !secret) return false;
	const parts = header.split(',').map((p) => p.split('='));
	const t = Number(parts.find(([k]) => k === 't')?.[1]);
	const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
	if (!Number.isFinite(t) || signatures.length === 0) return false;
	if (Math.abs(now / 1000 - t) > toleranceSeconds) return false;
	const expected = Buffer.from(hmac(secret, `${t}.${payload}`), 'hex');
	return signatures.some((s) => {
		const given = Buffer.from(s, 'hex');
		return given.length === expected.length && crypto.timingSafeEqual(given, expected);
	});
}

/** Secret for webhooks sent by the built-in payment simulator. */
export function simulatorSecret(): string {
	return `whsec_sim_${sign('stripe-simulator')}`;
}
