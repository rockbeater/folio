import { error } from '@sveltejs/kit';
import { listCustomers, listOrders, vatReport } from '$lib/server/store/orders';
import { fromMinor } from '$lib/store';
import type { RequestHandler } from './$types';

function csv(rows: (string | number | null)[][]): string {
	return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

const day = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString('sv-SE') : '');

/** CSV exports for bookkeeping: orders (with the current filters), customers and the VAT report. */
export const GET: RequestHandler = ({ params, url, locals }) => {
	if (!locals.admin) error(401);
	const q = (name: string) => url.searchParams.get(name) ?? '';
	let rows: (string | number | null)[][];
	if (params.kind === 'orders') {
		const { all } = listOrders({ number: q('number'), status: q('status'), customer: q('customer'), gallery: q('gallery'), kind: q('kind') });
		rows = [
			['number', 'date', 'paid', 'status', 'payment', 'name', 'email', 'country', 'gallery', 'type', 'currency', 'subtotal', 'discount', 'shipping', 'vat', 'total', 'refunded', 'coupon'],
			...all.map((o) => [
				o.number,
				day(o.createdAt),
				day(o.paidAt),
				o.status,
				o.paymentStatus,
				o.name,
				o.email,
				o.country,
				o.galleryName,
				o.kind,
				o.currency,
				fromMinor(o.subtotal, o.currency),
				fromMinor(o.discount, o.currency),
				fromMinor(o.shipping, o.currency),
				fromMinor(o.tax, o.currency),
				fromMinor(o.total, o.currency),
				fromMinor(o.refunded, o.currency),
				o.couponCode
			])
		];
	} else if (params.kind === 'customers') {
		rows = [['name', 'email', 'orders', 'currency', 'spent', 'last order'], ...listCustomers().map((c) => [c.name, c.email, c.orders, c.currency, fromMinor(c.spent, c.currency), day(c.lastOrder)])];
	} else if (params.kind === 'vat') {
		const currency = url.searchParams.get('currency') ?? 'EUR';
		rows = [['month', 'orders', 'revenue', 'vat', 'refunded'], ...vatReport(q('from'), q('to')).map((m) => [m.month, m.orders, fromMinor(m.revenue, currency), fromMinor(m.tax, currency), fromMinor(m.refunded, currency)])];
	} else error(404);
	return new Response(`﻿${csv(rows)}`, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="folio-${params.kind}-${new Date().toLocaleDateString('sv-SE')}.csv"`
		}
	});
};
