import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '$lib/server/db';
import { getStore } from '$lib/server/settings';
import { deleteProduct, getPriceList, listPriceLists, listProducts, removeProductImage, saveProduct, toProductData, updatePriceList } from '$lib/server/store/catalog';
import { fromPrice, toMinor } from '$lib/store';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const list = listPriceLists().find((l) => l.id === params.id);
	if (!list) error(404, 'not-found');
	const galleries = getDb().select({ id: schema.galleries.id, storeEnabled: schema.galleries.storeEnabled }).from(schema.galleries).all();
	const using = new Set(list.galleries.map((g) => g.id));
	return {
		list,
		totalGalleries: galleries.length,
		storeOn: galleries.filter((g) => g.storeEnabled && using.has(g.id)).length,
		currency: getStore().currency,
		products: listProducts(list.id).map((p) => {
			const data = toProductData(p);
			return { id: p.id, name: p.name, category: p.category, kind: p.kind, image: data.images[0] ?? null, from: fromPrice(data), variants: p.variants.length };
		})
	};
};

export const actions: Actions = {
	update: async ({ params, request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().slice(0, 100);
		if (!name) return fail(400);
		updatePriceList(params.id, { name, minOrder: toMinor(String(form.get('minOrder') ?? ''), getStore().currency) });
		return { saved: true };
	},
	/** Use this price list in every gallery, optionally turning their store on as well. */
	assignAll: async ({ params, request }) => {
		if (!getPriceList(params.id)) error(404);
		const enableStore = (await request.formData()).get('enableStore') === 'on';
		const result = getDb()
			.update(schema.galleries)
			.set(enableStore ? { priceListId: params.id, storeEnabled: true } : { priceListId: params.id })
			.run();
		return { assigned: result.changes };
	},
	addProduct: async ({ params, request }) => {
		if (!getPriceList(params.id)) error(404);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().slice(0, 120);
		if (!name) return fail(400);
		const kind = form.get('kind') === 'digital' ? 'digital' : 'physical';
		const id = saveProduct(null, params.id, {
			name,
			category: String(form.get('category') ?? '').trim().slice(0, 60),
			kind,
			digital: kind === 'digital' ? { scope: 'photo', size: 'highres' } : null
		});
		redirect(303, `/admin/store/products/${id}`);
	},
	deleteProduct: async ({ request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const product = getDb().select().from(schema.products).where(eq(schema.products.id, id)).get();
		if (product) {
			for (const image of product.images) await removeProductImage(image);
			deleteProduct(id);
		}
		return { saved: true };
	},
	move: async ({ params, request }) => {
		const form = await request.formData();
		const products = listProducts(params.id);
		const index = products.findIndex((p) => p.id === form.get('id'));
		const to = index + (form.get('dir') === 'up' ? -1 : 1);
		if (index < 0 || to < 0 || to >= products.length) return { saved: true };
		[products[index], products[to]] = [products[to], products[index]];
		const db = getDb();
		products.forEach((p, position) => db.update(schema.products).set({ position }).where(eq(schema.products.id, p.id)).run());
		return { saved: true };
	}
};
