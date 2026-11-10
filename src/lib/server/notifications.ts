import { and, desc, eq, gt, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { getDb, schema } from './db';
import { normalizeAccess } from '$lib/types';

/** What the owner is told about (the bell and the activity page). Visits are only counted, not listed. */
export const NOTIFICATION_KINDS = ['order', 'selection', 'download', 'registration'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationItem {
	id: string;
	kind: NotificationKind;
	at: number;
	galleryId: string | null;
	galleryName: string;
	/** Email or name of the visitor or buyer, if known. */
	who: string | null;
	href: string;
	order?: { number: number; total: number; currency: string };
	/** Photos downloaded or picked. */
	count?: number;
	/** Name of the submitted list. */
	list?: string;
}

const PLACED = ['paid', 'partially_refunded', 'refunded'] as const;

function wanted(kinds: readonly NotificationKind[] | undefined, kind: NotificationKind): boolean {
	return !kinds || kinds.length === 0 || kinds.includes(kind);
}

/** The newest items, before `before` (a time) when paging back. */
export function listNotifications(options: { before?: number; limit?: number; kinds?: readonly NotificationKind[] } = {}): NotificationItem[] {
	const db = getDb();
	const limit = Math.min(200, Math.max(1, options.limit ?? 20));
	const before = options.before ?? Number.MAX_SAFE_INTEGER;
	const items: NotificationItem[] = [];

	const visitorKinds = (['download', 'registration'] as const).filter((k) => wanted(options.kinds, k));
	if (visitorKinds.length) {
		const rows = db
			.select({ a: schema.activity, galleryName: schema.galleries.name })
			.from(schema.activity)
			.innerJoin(schema.galleries, eq(schema.galleries.id, schema.activity.galleryId))
			.where(and(inArray(schema.activity.kind, visitorKinds), lt(schema.activity.createdAt, before)))
			.orderBy(desc(schema.activity.createdAt))
			.limit(limit)
			.all();
		for (const { a, galleryName } of rows) {
			items.push({
				id: `a:${a.id}`,
				kind: a.kind as 'download' | 'registration',
				at: a.createdAt,
				galleryId: a.galleryId,
				galleryName,
				who: a.email,
				href: `/admin/galleries/${a.galleryId}?tab=activity`,
				count: a.detail?.count
			});
		}
	}

	if (wanted(options.kinds, 'order')) {
		const rows = db
			.select({ o: schema.orders, galleryName: schema.galleries.name })
			.from(schema.orders)
			.leftJoin(schema.galleries, eq(schema.galleries.id, schema.orders.galleryId))
			.where(and(inArray(schema.orders.paymentStatus, [...PLACED]), isNotNull(schema.orders.paidAt), lt(schema.orders.paidAt, before)))
			.orderBy(desc(schema.orders.paidAt))
			.limit(limit)
			.all();
		for (const { o, galleryName } of rows) {
			items.push({
				id: `o:${o.id}`,
				kind: 'order',
				at: o.paidAt!,
				galleryId: o.galleryId,
				galleryName: galleryName ?? '',
				who: o.name || o.email,
				href: `/admin/store/orders/${o.id}`,
				order: { number: o.number, total: o.total, currency: o.currency }
			});
		}
	}

	if (wanted(options.kinds, 'selection')) {
		const rows = db
			.select({
				l: schema.favoriteLists,
				galleryName: schema.galleries.name,
				access: schema.galleries.access,
				email: schema.visitors.email,
				count: sql<number>`(select count(*) from ${schema.favorites} where ${schema.favorites.listId} = ${schema.favoriteLists.id})`
			})
			.from(schema.favoriteLists)
			.innerJoin(schema.galleries, eq(schema.galleries.id, schema.favoriteLists.galleryId))
			.leftJoin(schema.visitors, eq(schema.visitors.id, schema.favoriteLists.visitorId))
			.where(and(isNotNull(schema.favoriteLists.submittedAt), lt(schema.favoriteLists.submittedAt, before)))
			.orderBy(desc(schema.favoriteLists.submittedAt))
			.limit(limit)
			.all();
		for (const { l, galleryName, access, email, count } of rows) {
			const preset = l.presetId ? normalizeAccess(access).lists.find((p) => p.id === l.presetId) : undefined;
			items.push({
				id: `l:${l.id}`,
				kind: 'selection',
				at: l.submittedAt!,
				galleryId: l.galleryId,
				galleryName,
				who: email,
				href: `/admin/galleries/${l.galleryId}?tab=activity`,
				count,
				list: preset?.name ?? l.name
			});
		}
	}

	return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** How many items came in after `since`. */
export function countNotificationsSince(since: number): number {
	const db = getDb();
	const count = (row: { n: number } | undefined) => Number(row?.n ?? 0);
	const n = sql<number>`count(*)`;
	return (
		count(
			db
				.select({ n })
				.from(schema.activity)
				.where(and(ne(schema.activity.kind, 'visit'), gt(schema.activity.createdAt, since)))
				.get()
		) +
		count(
			db
				.select({ n })
				.from(schema.orders)
				.where(and(inArray(schema.orders.paymentStatus, [...PLACED]), gt(schema.orders.paidAt, since)))
				.get()
		) +
		count(db.select({ n }).from(schema.favoriteLists).where(gt(schema.favoriteLists.submittedAt, since)).get())
	);
}
