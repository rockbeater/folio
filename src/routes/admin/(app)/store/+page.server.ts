import crypto from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { config } from '$lib/server/config';
import { getDb, schema } from '$lib/server/db';
import { getStore, saveStore } from '$lib/server/settings';
import {
	couponState,
	createPriceList,
	deletePriceList,
	duplicatePriceList,
	getPriceList,
	listCoupons,
	listPriceLists,
	listProducts,
	listShippingMethods,
	listTaxRates,
	setDefaultPriceList,
	updatePriceList
} from '$lib/server/store/catalog';
import { listCustomers, listOrders, vatReport } from '$lib/server/store/orders';
import { ensureWebhook, keyMode, removeWebhook, verifyKey } from '$lib/server/store/stripe';
import { toMinor } from '$lib/store';
import type { Actions, PageServerLoad } from './$types';

const TABS = ['orders', 'customers', 'pricelists', 'coupons', 'taxes', 'shipping', 'report', 'settings'] as const;
type Tab = (typeof TABS)[number];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function currencies(): string[] {
	try {
		return Intl.supportedValuesOf('currency');
	} catch {
		return ['EUR', 'USD', 'GBP', 'DKK', 'SEK', 'NOK', 'CHF', 'CAD', 'AUD', 'JPY'];
	}
}

export const load: PageServerLoad = ({ url }) => {
	const tab = ((TABS as readonly string[]).includes(url.searchParams.get('tab') ?? '') ? url.searchParams.get('tab') : 'orders') as Tab;
	const store = getStore();
	const base = { tab, currency: store.currency, enabled: store.enabled };
	const q = (name: string) => url.searchParams.get(name) ?? '';

	switch (tab) {
		case 'orders': {
			const filter = { number: q('number'), status: q('status'), customer: q('customer'), gallery: q('gallery'), kind: q('kind'), page: Number(q('page')) || 1 };
			const result = listOrders(filter);
			return {
				...base,
				filter,
				orders: {
					total: result.total,
					page: result.page,
					pages: result.pages,
					rows: result.rows.map((o) => ({
						id: o.id,
						number: o.number,
						status: o.status,
						paymentStatus: o.paymentStatus,
						name: o.name,
						email: o.email,
						galleryName: o.galleryName,
						kind: o.kind,
						createdAt: o.createdAt,
						total: o.total,
						currency: o.currency,
						simulated: o.stripeMode === 'simulated'
					}))
				}
			};
		}
		case 'customers': {
			const customer = q('customer');
			return {
				...base,
				customers: listCustomers(),
				customer,
				history: customer
					? listOrders({ customer }).all.filter((o) => o.email === customer).map((o) => ({ id: o.id, number: o.number, status: o.status, total: o.total, currency: o.currency, createdAt: o.createdAt, galleryName: o.galleryName }))
					: []
			};
		}
		case 'pricelists':
			return { ...base, priceLists: listPriceLists() };
		case 'coupons':
			return {
				...base,
				coupons: listCoupons().map((c) => ({ ...c, state: couponState(c) })),
				products: listPriceLists().flatMap((l) => listProducts(l.id).map((p) => ({ id: p.id, name: `${p.name} (${l.name})` }))),
				galleries: getDb().select({ id: schema.galleries.id, name: schema.galleries.name }).from(schema.galleries).all()
			};
		case 'taxes':
			return { ...base, taxes: listTaxRates() };
		case 'shipping':
			return { ...base, methods: listShippingMethods() };
		case 'report': {
			const from = DATE.test(q('from')) ? q('from') : `${new Date().getFullYear()}-01-01`;
			const to = DATE.test(q('to')) ? q('to') : new Date().toLocaleDateString('sv-SE');
			return { ...base, from, to, report: vatReport(from, to) };
		}
		default:
			return {
				...base,
				settings: {
					enabled: store.enabled,
					name: store.name,
					email: store.email,
					currency: store.currency,
					terms: store.terms,
					license: store.license
				},
				stripe: {
					connected: Boolean(store.stripe.secretKey),
					keyHint: store.stripe.secretKey ? `${store.stripe.secretKey.slice(0, 8)}…${store.stripe.secretKey.slice(-4)}` : '',
					mode: store.stripe.mode,
					accountName: store.stripe.accountName,
					webhook: Boolean(store.stripe.webhookId && store.stripe.webhookSecret),
					webhookUrl: store.stripe.webhookUrl,
					lastWebhookAt: store.stripe.lastWebhookAt,
					error: store.stripe.error
				},
				simulator: config.stripeSimulator,
				currencies: currencies()
			};
	}
};

async function formOf(request: Request) {
	const form = await request.formData();
	const str = (name: string, max = 200) => String(form.get(name) ?? '').trim().slice(0, max);
	return {
		form,
		str,
		bool: (name: string) => form.get(name) === 'on' || form.get(name) === 'true',
		money: (name: string) => toMinor(str(name, 20), getStore().currency),
		int: (name: string) => {
			const n = Number(str(name, 12));
			return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
		},
		list: (name: string) => form.getAll(name).map(String).filter(Boolean)
	};
}

export const actions: Actions = {
	settings: async ({ request }) => {
		const f = await formOf(request);
		const currency = f.str('currency', 3).toUpperCase();
		saveStore({
			enabled: f.bool('enabled'),
			name: f.str('name', 120),
			email: f.str('email', 254),
			currency: currencies().includes(currency) ? currency : getStore().currency,
			terms: f.str('terms', 20000),
			license: f.str('license', 20000)
		});
		return { saved: true };
	},

	stripeKey: async ({ request, url }) => {
		const f = await formOf(request);
		const key = f.str('secretKey', 300);
		if (!keyMode(key)) return fail(400, { stripeError: 'admin.stripe.errFormat' });
		try {
			const { mode, accountName } = await verifyKey(key);
			const previous = getStore().stripe;
			if (previous.secretKey && previous.secretKey !== key) await removeWebhook();
			saveStore({ stripe: { secretKey: key, mode, accountName, error: '' } });
			await ensureWebhook(config.baseUrl || url.origin);
			return { saved: true };
		} catch (err) {
			saveStore({ stripe: { error: (err as Error).message } });
			return fail(400, { stripeError: 'admin.stripe.errVerify', message: (err as Error).message });
		}
	},

	stripeWebhook: async ({ url }) => {
		try {
			saveStore({ stripe: { webhookSecret: '' } });
			await ensureWebhook(config.baseUrl || url.origin);
			saveStore({ stripe: { error: '' } });
			return { saved: true };
		} catch (err) {
			saveStore({ stripe: { error: (err as Error).message } });
			return fail(400, { stripeError: 'admin.stripe.errVerify', message: (err as Error).message });
		}
	},

	stripeDisconnect: async () => {
		await removeWebhook();
		saveStore({ stripe: { secretKey: '', mode: null, accountName: '', error: '', lastWebhookAt: null } });
		return { saved: true };
	},

	createPriceList: async ({ request }) => {
		const f = await formOf(request);
		const name = f.str('name', 100);
		if (!name) return fail(400);
		redirect(303, `/admin/store/price-lists/${createPriceList(name)}`);
	},

	duplicatePriceList: async ({ request }) => {
		const f = await formOf(request);
		const list = getPriceList(f.str('id'));
		if (!list) return fail(404);
		duplicatePriceList(list.id, `${list.name} (2)`);
		return { saved: true };
	},

	defaultPriceList: async ({ request }) => {
		setDefaultPriceList((await formOf(request)).str('id'));
		return { saved: true };
	},

	deletePriceList: async ({ request }) => {
		deletePriceList((await formOf(request)).str('id'));
		return { saved: true };
	},

	renamePriceList: async ({ request }) => {
		const f = await formOf(request);
		const name = f.str('name', 100);
		if (name) updatePriceList(f.str('id'), { name, minOrder: f.money('minOrder') });
		return { saved: true };
	},

	saveTax: async ({ request }) => {
		const f = await formOf(request);
		const country = f.str('country', 2).toUpperCase();
		const rate = Math.round(Number(f.str('rate', 10).replace(',', '.')) * 100);
		if (!/^[A-Z]{2}$/.test(country) || !Number.isFinite(rate) || rate < 0 || rate > 10000) return fail(400, { taxError: true });
		const values = { country, rate, shipping: f.bool('shipping'), digital: f.bool('digital') };
		const db = getDb();
		const existing = db.select().from(schema.taxRates).where(eq(schema.taxRates.country, country)).get();
		if (existing) db.update(schema.taxRates).set(values).where(eq(schema.taxRates.id, existing.id)).run();
		else db.insert(schema.taxRates).values({ id: crypto.randomUUID(), ...values }).run();
		return { saved: true };
	},

	deleteTax: async ({ request }) => {
		getDb().delete(schema.taxRates).where(eq(schema.taxRates.id, (await formOf(request)).str('id'))).run();
		return { saved: true };
	},

	saveShipping: async ({ request }) => {
		const f = await formOf(request);
		const country = f.str('country', 2).toUpperCase();
		const name = f.str('name', 100);
		if (!name || !(country === '*' || /^[A-Z]{2}$/.test(country))) return fail(400, { shippingError: true });
		const values = { name, country, fee: f.money('fee'), deliveryTime: f.str('deliveryTime', 100), pickup: f.bool('pickup') };
		const id = f.str('id');
		const db = getDb();
		if (id) db.update(schema.shippingMethods).set(values).where(eq(schema.shippingMethods.id, id)).run();
		else db.insert(schema.shippingMethods).values({ id: crypto.randomUUID(), ...values, position: listShippingMethods().length }).run();
		return { saved: true };
	},

	deleteShipping: async ({ request }) => {
		getDb().delete(schema.shippingMethods).where(eq(schema.shippingMethods.id, (await formOf(request)).str('id'))).run();
		return { saved: true };
	},

	saveCoupon: async ({ request }) => {
		const f = await formOf(request);
		const code = f.str('code', 40).toUpperCase().replace(/\s+/g, '');
		const name = f.str('name', 100);
		if (!code || !name) return fail(400, { couponError: 'admin.coupons.errRequired' });
		const id = f.str('id');
		const db = getDb();
		const clash = db.select({ id: schema.coupons.id }).from(schema.coupons).where(eq(schema.coupons.code, code)).get();
		if (clash && clash.id !== id) return fail(400, { couponError: 'admin.coupons.errCode' });
		const percent = f.int('percent');
		const values = {
			name,
			code,
			description: f.str('description', 300),
			startsOn: DATE.test(f.str('startsOn')) ? f.str('startsOn') : new Date().toLocaleDateString('sv-SE'),
			endsOn: DATE.test(f.str('endsOn')) ? f.str('endsOn') : null,
			percent: percent ? Math.min(100, percent) : null,
			amountOff: f.money('amountOff') || null,
			freeShipping: f.bool('freeShipping'),
			freeProductId: f.str('freeProductId') || null,
			minAmount: f.money('minAmount') || null,
			maxUses: f.int('maxUses'),
			oncePerGallery: f.bool('oncePerGallery'),
			galleryIds: f.list('galleryIds').length ? f.list('galleryIds') : null,
			productIds: f.list('productIds').length ? f.list('productIds') : null,
			banner: f.bool('banner'),
			active: f.bool('active')
		};
		if (id) db.update(schema.coupons).set(values).where(eq(schema.coupons.id, id)).run();
		else db.insert(schema.coupons).values({ id: crypto.randomUUID(), ...values }).run();
		return { saved: true };
	},

	deleteCoupon: async ({ request }) => {
		getDb().delete(schema.coupons).where(eq(schema.coupons.id, (await formOf(request)).str('id'))).run();
		return { saved: true };
	}
};
