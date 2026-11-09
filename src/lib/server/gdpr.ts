import { eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from './db';

/** Everything Folio stores about one email address (for a GDPR access request). */
export function personalData(email: string) {
	const db = getDb();
	const address = email.trim().toLowerCase();
	const galleries = new Map(db.select({ id: schema.galleries.id, name: schema.galleries.name }).from(schema.galleries).all().map((g) => [g.id, g.name]));
	const visitors = db.select().from(schema.visitors).where(eq(schema.visitors.email, address)).all();
	const lists = visitors.length ? db.select().from(schema.favoriteLists).where(inArray(schema.favoriteLists.visitorId, visitors.map((v) => v.id))).all() : [];
	const favorites = lists.length
		? db
				.select({ listId: schema.favorites.listId, filename: schema.photos.filename, note: schema.favorites.note })
				.from(schema.favorites)
				.innerJoin(schema.photos, eq(schema.photos.id, schema.favorites.photoId))
				.where(inArray(schema.favorites.listId, lists.map((l) => l.id)))
				.all()
		: [];
	const date = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);
	return {
		email: address,
		exportedAt: new Date().toISOString(),
		galleryVisits: visitors.map((v) => ({
			gallery: galleries.get(v.galleryId) ?? v.galleryId,
			firstSeen: date(v.createdAt),
			lists: lists
				.filter((l) => l.visitorId === v.id)
				.map((l) => ({
					name: l.name,
					submitted: date(l.submittedAt),
					shared: Boolean(l.shareToken),
					photos: favorites.filter((f) => f.listId === l.id).map((f) => ({ filename: f.filename, note: f.note }))
				}))
		})),
		activity: db
			.select()
			.from(schema.activity)
			.where(eq(schema.activity.email, address))
			.all()
			.map((a) => ({ gallery: galleries.get(a.galleryId) ?? a.galleryId, kind: a.kind, detail: a.detail, at: date(a.createdAt) })),
		emails: db
			.select({ subject: schema.emailLog.subject, status: schema.emailLog.status, createdAt: schema.emailLog.createdAt })
			.from(schema.emailLog)
			.where(sql`lower(${schema.emailLog.recipient}) = ${address}`)
			.all()
			.map((e) => ({ subject: e.subject, status: e.status, at: date(e.createdAt) })),
		clientOf: db
			.select({ name: schema.galleries.name, clientName: schema.galleries.clientName })
			.from(schema.galleries)
			.where(sql`lower(${schema.galleries.clientEmail}) = ${address}`)
			.all(),
		orders: db
			.select()
			.from(schema.orders)
			.where(eq(schema.orders.email, address))
			.all()
			.map((o) => ({ number: o.number, date: date(o.createdAt), name: o.name, phone: o.phone, address: o.address, total: o.total, currency: o.currency, status: o.status }))
	};
}

export function summary(email: string) {
	const data = personalData(email);
	return {
		visits: data.galleryVisits.length,
		lists: data.galleryVisits.reduce((sum, v) => sum + v.lists.length, 0),
		activity: data.activity.length,
		emails: data.emails.length,
		clientOf: data.clientOf.length,
		orders: data.orders.length
	};
}

/**
 * Delete what Folio stores about an email address: visitor records with their favorite
 * lists, activity, sent emails and the client contact on galleries. Orders are kept,
 * because bookkeeping rules require them.
 */
export function deletePersonalData(email: string): void {
	const address = email.trim().toLowerCase();
	const db = getDb();
	db.transaction((tx) => {
		tx.delete(schema.visitors).where(eq(schema.visitors.email, address)).run();
		tx.delete(schema.activity).where(eq(schema.activity.email, address)).run();
		tx.delete(schema.emailLog).where(sql`lower(${schema.emailLog.recipient}) = ${address}`).run();
		tx.update(schema.galleries).set({ clientEmail: null, clientName: null }).where(sql`lower(${schema.galleries.clientEmail}) = ${address}`).run();
	});
}
