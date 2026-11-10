import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-store-'));
process.env.PHOTOS_DIR = path.join(tmp, 'photos');
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.CACHE_DIR = path.join(tmp, 'cache');

let dbm: typeof import('../db');
let orders: typeof import('./orders');
let stripe: typeof import('./stripe');
let settings: typeof import('../settings');

beforeAll(async () => {
	dbm = await import('../db');
	orders = await import('./orders');
	stripe = await import('./stripe');
	settings = await import('../settings');
	const db = dbm.getDb();
	const { schema } = dbm;
	db.insert(schema.galleries).values({ id: 'g1', folder: 'G', name: 'Wedding', slug: 'wedding', status: 'published', design: {} as never, download: {} as never, storeEnabled: true }).run();
	db.insert(schema.sections).values({ id: 's1', galleryId: 'g1', folder: 'Ceremony', slug: 'ceremony' }).run();
	db.insert(schema.photos).values({ id: 'p1', galleryId: 'g1', sectionId: 's1', filename: 'a.jpg', size: 1, mtimeMs: 1, width: 3000, height: 2000, status: 'ready' }).run();
	db.insert(schema.photos).values({ id: 'p2', galleryId: 'g1', sectionId: 's1', filename: 'b.jpg', size: 1, mtimeMs: 1, width: 3000, height: 2000, status: 'ready', private: true }).run();
	db.insert(schema.priceLists).values({ id: 'l1', name: 'Default', isDefault: true }).run();
	db.insert(schema.products).values({ id: 'print', priceListId: 'l1', name: 'Print', price: 10000 }).run();
	db.insert(schema.shippingMethods).values({ id: 'post', name: 'Post', country: 'DK', fee: 5000 }).run();
	db.insert(schema.taxRates).values({ id: 't', country: 'DK', rate: 2500 }).run();
	settings.saveStore({ enabled: true, currency: 'EUR' });
});

describe('order flow', () => {
	const input = {
		email: 'buyer@example.com',
		name: 'Buyer',
		phone: '',
		country: 'DK',
		address: { line1: 'Street 1', line2: '', postalCode: '1000', city: 'Town', country: 'DK' },
		methodId: 'post',
		acceptTerms: true,
		acceptLicense: true
	};
	const cart = (photoId: string) => ({ items: [{ id: 'i1', productId: 'print', variantKey: '', photoId, quantity: 2, crop: null }], couponCode: null });

	it('places an order, and only a signed webhook marks it as paid', async () => {
		const gallery = (await import('../galleries')).getGalleryById('g1')!;
		const result = await orders.placeOrder(gallery, 'guest', cart('p1'), input, 'http://localhost', true);
		expect('redirect' in result && result.redirect.startsWith('/store/simulate/')).toBe(true);
		const order = dbm.getDb().select().from(dbm.schema.orders).get()!;
		expect(order.total).toBe(25000);
		expect(order.tax).toBe(5000);
		expect(order.paymentStatus).toBe('unpaid');
		// Not an order yet: no real number, and not listed in the admin.
		expect(order.number).toBeLessThan(0);
		expect(orders.listOrders().total).toBe(0);

		const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: { client_reference_id: order.id, payment_status: 'paid', payment_intent: 'pi_1' } } });
		expect(stripe.verifySignature(payload, stripe.signatureHeader(payload, 'wrong'), stripe.simulatorSecret())).toBe(false);
		orders.handleStripeEvent(JSON.parse(payload));
		const paid = orders.getOrder(order.id)!;
		expect(paid.paymentStatus).toBe('paid');
		expect(paid.status).toBe('processing');
		expect(paid.number).toBe(1001);
		expect(orders.listOrders().total).toBe(1);

		await orders.refundOrder({ ...paid, stripeMode: 'simulated' }, 5000);
		expect(orders.getOrder(order.id)!.paymentStatus).toBe('partially_refunded');
	});

	it('refuses to order a print until the buyer has chosen the crop', async () => {
		const gallery = (await import('../galleries')).getGalleryById('g1')!;
		const crop = { x: 0, y: 0.1, w: 1, h: 0.8 };
		const unconfirmed = { items: [{ ...cart('p1').items[0], crop, cropConfirmed: false }], couponCode: null };
		expect(await orders.placeOrder(gallery, 'guest', unconfirmed, input, 'http://localhost', true)).toEqual({ error: 'crop' });
		const confirmed = { items: [{ ...cart('p1').items[0], crop, cropConfirmed: true }], couponCode: null };
		const result = await orders.placeOrder(gallery, 'guest', confirmed, input, 'http://localhost', true);
		expect('redirect' in result).toBe(true);
	});

	it('does not let a guest buy a private photo', async () => {
		const gallery = (await import('../galleries')).getGalleryById('g1')!;
		const result = await orders.placeOrder(gallery, 'guest', cart('p2'), input, 'http://localhost', true);
		expect(result).toEqual({ error: 'empty' });
	});
});
