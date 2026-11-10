import { describe, expect, it } from 'vitest';
import { availableValues, centeredCrop, computeTotals, printAspect, settleValues, syncVariants, variantKey, type ProductData } from './store';
import { encode, signatureHeader, verifySignature } from './server/store/stripe';

const product = (over: Partial<ProductData> = {}): ProductData => ({
	id: 'p1',
	category: '',
	name: 'Print',
	description: '',
	images: [],
	kind: 'physical',
	digital: null,
	options: [],
	variants: [],
	price: 10000,
	extraShipping: 500,
	noPhoto: false,
	taxExempt: false,
	maxOne: false,
	multiPhoto: false,
	...over
});

describe('store totals', () => {
	const rate = { country: 'DK', rate: 2500, shipping: true, digital: true };
	const method = { id: 'm', name: 'Post', country: 'DK', fee: 5000, deliveryTime: '', pickup: false };

	it('adds shipping, extra shipping and VAT included in the prices', () => {
		const t = computeTotals({ lines: [{ id: 'a', product: product(), variantKey: '', quantity: 2 }], coupon: null, method, rate });
		expect(t.subtotal).toBe(20000);
		expect(t.shipping).toBe(5000 + 1000);
		expect(t.total).toBe(26000);
		expect(t.tax).toBe(4000 + 1200);
	});

	it('applies percent discounts, free shipping and a free product', () => {
		const coupon = { code: 'X', percent: 10, amountOff: null, freeShipping: true, freeProductId: null, minAmount: null, productIds: null };
		const t = computeTotals({ lines: [{ id: 'a', product: product(), variantKey: '', quantity: 2 }], coupon, method, rate });
		expect(t.discount).toBe(2000);
		expect(t.shipping).toBe(0);
		expect(t.total).toBe(18000);
		const free = computeTotals({ lines: [{ id: 'a', product: product(), variantKey: '', quantity: 2 }], coupon: { ...coupon, percent: null, freeProductId: 'p1' }, method, rate });
		expect(free.discount).toBe(10000);
	});

	it('respects the minimum amount and digital-only orders need no shipping', () => {
		const coupon = { code: 'X', percent: 50, amountOff: null, freeShipping: false, freeProductId: null, minAmount: 50000, productIds: null };
		const digital = product({ kind: 'digital', digital: { scope: 'photo', size: 'highres' } });
		const t = computeTotals({ lines: [{ id: 'a', product: digital, variantKey: '', quantity: 1 }], coupon, method: null, rate });
		expect(t.couponProblem).toBe('minAmount');
		expect(t.discount).toBe(0);
		expect(t.needsShipping).toBe(false);
		expect(t.total).toBe(10000);
	});

	it('builds the variant matrix and keeps existing prices', () => {
		const options = [
			{ id: 'size', name: 'Size', values: [{ id: 's1', name: '13x18' }, { id: 's2', name: 'A4' }] },
			{ id: 'paper', name: 'Paper', values: [{ id: 'g', name: 'Glossy' }] }
		];
		const existing = [{ key: variantKey(['s2', 'g']), price: 999, extraShipping: 0, visible: false }];
		const variants = syncVariants(options, existing, 100);
		expect(variants.map((v) => v.key)).toEqual(['s1|g', 's2|g']);
		expect(variants[1]).toEqual(existing[0]);
	});

	it('offers only option values that belong to a visible combination', () => {
		const p = product({
			options: [
				{ id: 'size', name: 'Size', values: [{ id: 's', name: '10x15' }, { id: 'm', name: '20x30' }, { id: 'l', name: '30x40' }] },
				{ id: 'paper', name: 'Paper', values: [{ id: 'g', name: 'Glossy' }, { id: 'sg', name: 'Semi glossy' }] }
			],
			variants: [
				{ key: 's|g', price: 100, extraShipping: 0, visible: true },
				{ key: 's|sg', price: 120, extraShipping: 0, visible: true },
				{ key: 'm|g', price: 200, extraShipping: 0, visible: false },
				{ key: 'm|sg', price: 220, extraShipping: 0, visible: true },
				{ key: 'l|g', price: 300, extraShipping: 0, visible: false },
				{ key: 'l|sg', price: 320, extraShipping: 0, visible: false }
			]
		});
		expect(availableValues(p, [], 0).map((v) => v.id)).toEqual(['s', 'm']);
		expect(availableValues(p, ['m'], 1).map((v) => v.id)).toEqual(['sg']);
		expect(settleValues(p, [])).toEqual(['s', 'g']);
		// Picking 20x30 while Glossy is chosen moves the paper to the only one that exists.
		expect(settleValues(p, ['m', 'g'])).toEqual(['m', 'sg']);
		expect(settleValues(p, ['s', 'sg'])).toEqual(['s', 'sg']);
	});

	it('finds print aspect ratios and centered crops', () => {
		expect(printAspect('13x18 / Glossy')).toBeCloseTo(18 / 13);
		expect(printAspect('A4')).toBeCloseTo(Math.SQRT2);
		expect(printAspect('Glossy')).toBeNull();
		const crop = centeredCrop(3000, 2000, 1.5);
		expect(crop).toEqual({ x: 0, y: 0, w: 1, h: 1 });
		const square = centeredCrop(2000, 2000, 1.5);
		expect(square.w).toBe(1);
		expect(square.h).toBeCloseTo(2 / 3);
	});
});

describe('stripe helpers', () => {
	it('encodes nested parameters like Stripe expects', () => {
		const body = encode({ line_items: [{ price_data: { unit_amount: 100 } }], metadata: { order_id: 'x' } }).toString();
		expect(decodeURIComponent(body)).toBe('line_items[0][price_data][unit_amount]=100&metadata[order_id]=x');
	});

	it('verifies webhook signatures and rejects tampering and old events', () => {
		const payload = JSON.stringify({ type: 'checkout.session.completed' });
		const header = signatureHeader(payload, 'whsec_test');
		expect(verifySignature(payload, header, 'whsec_test')).toBe(true);
		expect(verifySignature(`${payload} `, header, 'whsec_test')).toBe(false);
		expect(verifySignature(payload, header, 'whsec_other')).toBe(false);
		const old = signatureHeader(payload, 'whsec_test', Math.floor(Date.now() / 1000) - 3600);
		expect(verifySignature(payload, old, 'whsec_test')).toBe(false);
	});
});
