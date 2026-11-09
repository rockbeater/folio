import { error, fail } from '@sveltejs/kit';
import { getStore } from '$lib/server/settings';
import { getPriceList, getProduct, listProducts, removeProductImage, saveProduct, saveProductImage } from '$lib/server/store/catalog';
import { syncVariants, toMinor, type DigitalSpec, type ProductOption, type Variant } from '$lib/store';
import type { Actions, PageServerLoad } from './$types';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const load: PageServerLoad = ({ params }) => {
	const product = getProduct(params.id);
	if (!product) error(404, 'not-found');
	const list = getPriceList(product.priceListId)!;
	return {
		product,
		list: { id: list.id, name: list.name },
		categories: [...new Set(listProducts(list.id).map((p) => p.category).filter(Boolean))],
		currency: getStore().currency
	};
};

function parseOptions(value: unknown): ProductOption[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === 'object')
		.map((o) => ({
			id: String(o.id ?? ''),
			name: String(o.name ?? '').trim().slice(0, 60),
			values: (Array.isArray(o.values) ? o.values : [])
				.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
				.map((v) => ({ id: String(v.id ?? ''), name: String(v.name ?? '').trim().slice(0, 60) }))
				.filter((v) => v.id && v.name)
				.slice(0, 50)
		}))
		.filter((o) => o.id && o.name && o.values.length > 0)
		.slice(0, 5);
}

export const actions: Actions = {
	save: async ({ params, request }) => {
		const product = getProduct(params.id);
		if (!product) error(404);
		const form = await request.formData();
		const str = (name: string, max = 200) => String(form.get(name) ?? '').trim().slice(0, max);
		const currency = getStore().currency;
		const name = str('name', 120);
		if (!name) return fail(400, { error: 'name' });

		let options: ProductOption[] = [];
		let variants: Variant[] = [];
		try {
			options = parseOptions(JSON.parse(str('options', 100000) || '[]'));
			const given = JSON.parse(str('variants', 500000) || '[]') as Variant[];
			variants = syncVariants(options, Array.isArray(given) ? given : [], 0).map((v) => {
				const g = given.find((x) => x.key === v.key);
				return g
					? { key: v.key, price: Math.max(0, Math.round(Number(g.price) || 0)), extraShipping: Math.max(0, Math.round(Number(g.extraShipping) || 0)), visible: Boolean(g.visible) }
					: v;
			});
		} catch {
			return fail(400, { error: 'options' });
		}

		// Images: keep the ones not removed, then add uploads, at most 5.
		const removed = new Set(form.getAll('removeImage').map(String));
		const images = product.images.filter((img) => !removed.has(img));
		for (const img of removed) if (product.images.includes(img)) await removeProductImage(img);
		for (const file of form.getAll('images')) {
			if (!(file instanceof File) || file.size === 0) continue;
			if (images.length >= 5) break;
			if (!IMAGE_TYPES.has(file.type) || file.size > 20 * 1024 * 1024) return fail(400, { error: 'image' });
			images.push(await saveProductImage(Buffer.from(await file.arrayBuffer())));
		}

		const kind = str('kind') === 'digital' ? 'digital' : 'physical';
		const scope = str('scope');
		const digital: DigitalSpec | null =
			kind === 'digital'
				? { scope: scope === 'section' || scope === 'gallery' ? scope : 'photo', size: str('size') === 'web' ? 'web' : 'highres' }
				: null;

		saveProduct(product.id, product.priceListId, {
			name,
			category: str('category', 60),
			description: str('description', 5000),
			images,
			kind,
			digital,
			options: kind === 'digital' ? [] : options,
			variants: kind === 'digital' ? [] : variants,
			price: toMinor(str('price', 20), currency),
			extraShipping: kind === 'digital' ? 0 : toMinor(str('extraShipping', 20), currency),
			noPhoto: kind === 'physical' && form.get('noPhoto') === 'on',
			taxExempt: form.get('taxExempt') === 'on',
			maxOne: form.get('maxOne') === 'on',
			multiPhoto: form.get('multiPhoto') === 'on'
		});
		return { saved: true };
	}
};
