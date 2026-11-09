import { fail, redirect } from '@sveltejs/kit';
import { config } from '$lib/server/config';
import { loadClientGallery, visitorInfo } from '$lib/server/client';
import { getStore } from '$lib/server/settings';
import { listShippingMethods } from '$lib/server/store/catalog';
import { getCart, priceCart } from '$lib/server/store/cart';
import { placeOrder } from '$lib/server/store/orders';
import { COUNTRY_CODES } from '$lib/countries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, cookies, locals }) => {
	const { gallery, state, role } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (state !== 'open') return { cart: null, terms: '', license: '', countries: [] as string[], email: '' };
	const cart = getCart(cookies, gallery.id);
	const view = priceCart(gallery, role, cart?.items ?? [], cart?.couponCode ?? null);
	const methods = listShippingMethods();
	const store = getStore();
	// With an international method every country can order; otherwise only the countries with their own methods.
	const countries = methods.some((m) => m.country === '*') ? COUNTRY_CODES : (view?.countries ?? []);
	return {
		cart: view,
		terms: store.terms,
		license: store.license,
		countries: countries.length ? countries : COUNTRY_CODES,
		email: visitorInfo(cookies, gallery).email ?? ''
	};
};

export const actions: Actions = {
	checkout: async ({ params, cookies, locals, request, url }) => {
		const { gallery, state, role } = loadClientGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
		if (state !== 'open') return fail(403);
		const form = await request.formData();
		const str = (name: string, max = 200) => String(form.get(name) ?? '').trim().slice(0, max);
		const cart = getCart(cookies, gallery.id);
		const input = {
			email: str('email', 254),
			name: str('name'),
			phone: str('phone', 40),
			country: str('country', 2).toUpperCase(),
			address: { line1: str('line1'), line2: str('line2'), postalCode: str('postalCode', 20), city: str('city'), country: str('country', 2).toUpperCase() },
			methodId: str('methodId', 64),
			acceptTerms: form.get('terms') === 'on',
			acceptLicense: form.get('license') === 'on'
		};
		const result = await placeOrder(
			gallery,
			role,
			{ items: cart?.items ?? [], couponCode: cart?.couponCode ?? null },
			input,
			config.baseUrl || url.origin,
			config.stripeSimulator
		);
		if ('error' in result) return fail(400, { error: result.error, message: result.message ?? '', values: { ...input, address: input.address } });
		redirect(303, result.redirect);
	}
};
