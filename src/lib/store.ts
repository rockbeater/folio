// Store logic shared by the server and the client pages: money, variants and order totals.
// Amounts are integers in the currency's minor unit (cents for EUR/USD, whole yen for JPY).
// Prices include VAT; the VAT part is calculated from the rate of the buyer's country.

export type ProductKind = 'physical' | 'digital';
export type DigitalScope = 'photo' | 'section' | 'gallery';

export interface DigitalSpec {
	scope: DigitalScope;
	size: 'highres' | 'web';
}

export interface ProductOption {
	id: string;
	name: string;
	values: { id: string; name: string }[];
}

/** One combination of option values ("10x15 / Glossy") with its own price. */
export interface Variant {
	key: string;
	price: number;
	extraShipping: number;
	visible: boolean;
}

export interface ProductData {
	id: string;
	category: string;
	name: string;
	description: string;
	images: string[];
	kind: ProductKind;
	digital: DigitalSpec | null;
	options: ProductOption[];
	variants: Variant[];
	/** Price and extra shipping for products without options. */
	price: number;
	extraShipping: number;
	/** Can be added to the cart without choosing a photo (e.g. a USB stick). */
	noPhoto: boolean;
	taxExempt: boolean;
	/** At most one per order. */
	maxOne: boolean;
	/** The buyer can pick several photos for this product in one step. */
	multiPhoto: boolean;
}

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = 'unpaid' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';

/** Value ids in option order, joined. Products without options use the empty key. */
export function variantKey(valueIds: string[]): string {
	return valueIds.join('|');
}

/** Every combination of option values, in option order. */
export function combinations(options: ProductOption[]): string[][] {
	return options.reduce<string[][]>(
		(acc, option) => acc.flatMap((combo) => option.values.map((v) => [...combo, v.id])),
		options.length ? [[]] : []
	);
}

/** Rebuild the variant matrix after the options changed; existing combinations keep their values. */
export function syncVariants(options: ProductOption[], existing: Variant[], defaultPrice: number): Variant[] {
	const byKey = new Map(existing.map((v) => [v.key, v]));
	return combinations(options).map((ids) => {
		const key = variantKey(ids);
		return byKey.get(key) ?? { key, price: defaultPrice, extraShipping: 0, visible: true };
	});
}

export function variantLabel(product: Pick<ProductData, 'options'>, key: string): string {
	if (!key) return '';
	const ids = key.split('|');
	return product.options
		.map((option, i) => option.values.find((v) => v.id === ids[i])?.name ?? '')
		.filter(Boolean)
		.join(' / ');
}

/** Price of a variant, or null if it does not exist or is hidden. */
export function priceOf(product: ProductData, key: string): { price: number; extraShipping: number } | null {
	if (product.options.length === 0) return key ? null : { price: product.price, extraShipping: product.extraShipping };
	const variant = product.variants.find((v) => v.key === key);
	return variant && variant.visible ? { price: variant.price, extraShipping: variant.extraShipping } : null;
}

export function visibleVariants(product: ProductData): Variant[] {
	return product.variants.filter((v) => v.visible);
}

/**
 * The values of option `index` the buyer can pick, given the values picked for the options before it.
 * Values that only appear in hidden combinations are left out, so the buyer never sees a dead end.
 */
export function availableValues(product: ProductData, chosen: string[], index: number): ProductOption['values'] {
	const ids = new Set(
		visibleVariants(product)
			.map((v) => v.key.split('|'))
			.filter((ids) => ids.slice(0, index).every((id, i) => id === chosen[i]))
			.map((ids) => ids[index])
	);
	return product.options[index].values.filter((v) => ids.has(v.id));
}

/** Keep the picked values that still fit and replace the others with the first value that does. */
export function settleValues(product: ProductData, chosen: string[]): string[] {
	const out: string[] = [];
	product.options.forEach((_, i) => {
		const values = availableValues(product, out, i);
		out.push(values.some((v) => v.id === chosen[i]) ? chosen[i] : (values[0]?.id ?? ''));
	});
	return out;
}

/** The lowest price the buyer can choose ("From …"). */
export function fromPrice(product: ProductData): number | null {
	if (product.options.length === 0) return product.price;
	const prices = visibleVariants(product).map((v) => v.price);
	return prices.length ? Math.min(...prices) : null;
}

export function isBuyable(product: ProductData): boolean {
	return fromPrice(product) !== null;
}

export function currencyDigits(currency: string): number {
	try {
		return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
	} catch {
		return 2;
	}
}

export function formatMoney(amount: number, currency: string, lang: string): string {
	const digits = currencyDigits(currency);
	try {
		return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(amount / 10 ** digits);
	} catch {
		return `${(amount / 10 ** digits).toFixed(digits)} ${currency}`;
	}
}

/** "12.50" or "12,50" (as typed by the photographer) to minor units. */
export function toMinor(value: string | number, currency: string): number {
	const n = typeof value === 'number' ? value : Number(String(value).trim().replace(/\s/g, '').replace(',', '.'));
	return Number.isFinite(n) && n > 0 ? Math.round(n * 10 ** currencyDigits(currency)) : 0;
}

export function fromMinor(amount: number, currency: string): string {
	const digits = currencyDigits(currency);
	return (amount / 10 ** digits).toFixed(digits);
}

/** Aspect ratio (long side / short side) of a print size in a variant label, e.g. "13x18" or "A4". */
export function printAspect(label: string): number | null {
	const m = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i.exec(label);
	if (m) {
		const a = Number(m[1].replace(',', '.'));
		const b = Number(m[2].replace(',', '.'));
		if (a > 0 && b > 0) return Math.max(a, b) / Math.min(a, b);
	}
	if (/\bA[0-6]\b/i.test(label)) return Math.SQRT2;
	return null;
}

/** A crop as fractions of the photo: x, y, width and height between 0 and 1. */
export interface Crop {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Centered crop of a photo to the given aspect ratio, in the photo's orientation. */
export function centeredCrop(photoW: number, photoH: number, aspect: number): Crop {
	const landscape = photoW >= photoH;
	const target = landscape ? aspect : 1 / aspect; // width / height of the print in the photo's orientation
	const photo = photoW / photoH;
	if (Math.abs(photo - target) < 0.01) return { x: 0, y: 0, w: 1, h: 1 };
	if (photo > target) {
		const w = target / photo;
		return { x: (1 - w) / 2, y: 0, w, h: 1 };
	}
	const h = photo / target;
	return { x: 0, y: (1 - h) / 2, w: 1, h };
}

// --- Totals ---------------------------------------------------------------

export interface TaxRate {
	country: string;
	/** Basis points: 2500 is 25 %. */
	rate: number;
	shipping: boolean;
	digital: boolean;
}

export interface ShippingMethod {
	id: string;
	name: string;
	/** ISO country code, or '*' for the rest of the world. */
	country: string;
	fee: number;
	deliveryTime: string;
	pickup: boolean;
}

export interface CouponRules {
	code: string;
	percent: number | null;
	amountOff: number | null;
	freeShipping: boolean;
	freeProductId: string | null;
	minAmount: number | null;
	productIds: string[] | null;
}

export interface LineInput {
	id: string;
	product: ProductData;
	variantKey: string;
	quantity: number;
}

export interface PricedLine {
	id: string;
	productId: string;
	kind: ProductKind;
	label: string;
	unitPrice: number;
	quantity: number;
	gross: number;
	extraShipping: number;
	discount: number;
	taxRate: number;
	tax: number;
}

export interface Totals {
	lines: PricedLine[];
	subtotal: number;
	discount: number;
	shipping: number;
	shippingTax: number;
	tax: number;
	total: number;
	kind: 'physical' | 'digital' | 'mixed' | 'none';
	needsShipping: boolean;
	/** Why the coupon did not apply, if it did not. */
	couponProblem: 'minAmount' | 'noProducts' | null;
}

export function orderKind(kinds: ProductKind[]): Totals['kind'] {
	const physical = kinds.includes('physical');
	const digital = kinds.includes('digital');
	return physical && digital ? 'mixed' : physical ? 'physical' : digital ? 'digital' : 'none';
}

const vatOf = (gross: number, rate: number) => (rate > 0 ? Math.round((gross * rate) / (10000 + rate)) : 0);

/** Prices, discount, shipping and VAT of a cart. Lines with unknown or hidden variants must be removed first. */
export function computeTotals(input: {
	lines: LineInput[];
	coupon: CouponRules | null;
	method: ShippingMethod | null;
	rate: TaxRate | null;
}): Totals {
	const lines: PricedLine[] = input.lines.map((l) => {
		const price = priceOf(l.product, l.variantKey) ?? { price: 0, extraShipping: 0 };
		const quantity = Math.max(1, Math.floor(l.quantity));
		return {
			id: l.id,
			productId: l.product.id,
			kind: l.product.kind,
			label: variantLabel(l.product, l.variantKey),
			unitPrice: price.price,
			quantity,
			gross: price.price * quantity,
			extraShipping: l.product.kind === 'physical' ? price.extraShipping * quantity : 0,
			discount: 0,
			taxRate: 0,
			tax: 0
		};
	});
	const subtotal = lines.reduce((sum, l) => sum + l.gross, 0);
	const needsShipping = lines.some((l) => l.kind === 'physical');

	// Discount
	let couponProblem: Totals['couponProblem'] = null;
	let freeShipping = false;
	const c = input.coupon;
	if (c) {
		const eligible = lines.filter((l) => !c.productIds || c.productIds.includes(l.productId));
		if (c.minAmount && subtotal < c.minAmount) couponProblem = 'minAmount';
		else if (eligible.length === 0 && (c.percent || c.amountOff)) couponProblem = 'noProducts';
		else {
			freeShipping = c.freeShipping;
			const eligibleGross = eligible.reduce((sum, l) => sum + l.gross, 0);
			let amount = 0;
			if (c.percent) amount += Math.round((eligibleGross * Math.min(100, c.percent)) / 100);
			if (c.amountOff) amount += Math.min(c.amountOff, eligibleGross);
			amount = Math.min(amount, eligibleGross);
			// Spread the discount over the eligible lines (for the VAT), the remainder on the last line.
			let left = amount;
			eligible.forEach((l, i) => {
				const share = i === eligible.length - 1 ? left : Math.round((amount * l.gross) / (eligibleGross || 1));
				l.discount = Math.min(l.gross, share);
				left -= l.discount;
			});
			if (c.freeProductId) {
				const line = lines
					.filter((l) => l.productId === c.freeProductId && l.gross - l.discount >= l.unitPrice)
					.sort((a, b) => a.unitPrice - b.unitPrice)[0];
				if (line) line.discount += line.unitPrice;
			}
		}
	}

	// VAT per line, on the price after discount.
	const rate = input.rate;
	for (const l of lines) {
		const applies = rate && !(l.kind === 'digital' && !rate.digital) && !productExempt(input.lines, l.id);
		l.taxRate = applies ? rate.rate : 0;
		l.tax = vatOf(l.gross - l.discount, l.taxRate);
	}

	let shipping = 0;
	if (needsShipping && input.method && !freeShipping) {
		shipping = input.method.fee + lines.reduce((sum, l) => sum + l.extraShipping, 0);
	}
	const shippingTax = rate?.shipping ? vatOf(shipping, rate.rate) : 0;
	const discount = lines.reduce((sum, l) => sum + l.discount, 0);
	const tax = lines.reduce((sum, l) => sum + l.tax, 0) + shippingTax;

	return {
		lines,
		subtotal,
		discount,
		shipping,
		shippingTax,
		tax,
		total: subtotal - discount + shipping,
		kind: orderKind(lines.map((l) => l.kind)),
		needsShipping,
		couponProblem
	};
}

function productExempt(lines: LineInput[], id: string): boolean {
	return Boolean(lines.find((l) => l.id === id)?.product.taxExempt);
}

/** Shipping methods for a country: its own methods, or the international ones if it has none. */
export function methodsFor(methods: ShippingMethod[], country: string): ShippingMethod[] {
	const own = methods.filter((m) => m.country === country);
	return own.length ? own : methods.filter((m) => m.country === '*');
}

/**
 * Simple formatting for product descriptions, terms and the licence:
 * **bold**, *italic*, __underline__, [text](https://link) and line breaks. Everything else is escaped.
 */
export function richText(source: string): string {
	const escaped = source
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
	return escaped
		.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/__([^_]+)__/g, '<u>$1</u>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		.split(/\n{2,}/)
		.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
		.join('');
}
