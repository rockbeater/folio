import crypto from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { isExpired } from './access';
import { randomToken } from './crypto';
import { getDb, schema } from './db';
import type { ShareDownload, ShareLink } from './db/schema';

/** Quick share links: a named link to selected photos, with its own download rules, expiry and password. */

export function listShareLinks(galleryId: string): ShareLink[] {
	return getDb()
		.select()
		.from(schema.shareLinks)
		.where(eq(schema.shareLinks.galleryId, galleryId))
		.orderBy(desc(schema.shareLinks.createdAt))
		.all();
}

export function getShareLink(id: string): ShareLink | undefined {
	return getDb().select().from(schema.shareLinks).where(eq(schema.shareLinks.id, id)).get();
}

export function getShareLinkByToken(token: string): ShareLink | undefined {
	if (!token || token.length < 20) return undefined;
	return getDb().select().from(schema.shareLinks).where(eq(schema.shareLinks.token, token)).get();
}

/** Active and not past its expiry date. */
export function isLinkOpen(link: ShareLink): boolean {
	return link.active && !isExpired(link);
}

export interface ShareLinkInput {
	name: string;
	download: ShareDownload;
	expiresOn: string | null;
	password: string | null;
}

export function createShareLink(galleryId: string, photoIds: string[], input: ShareLinkInput): ShareLink {
	const id = crypto.randomUUID();
	getDb()
		.insert(schema.shareLinks)
		.values({ id, token: randomToken(24), galleryId, photoIds: [...new Set(photoIds)], ...input })
		.run();
	return getShareLink(id)!;
}

export function updateShareLink(id: string, values: Partial<ShareLinkInput & { active: boolean; photoIds: string[] }>): void {
	getDb().update(schema.shareLinks).set(values).where(eq(schema.shareLinks.id, id)).run();
}

export function deleteShareLink(id: string): void {
	getDb().delete(schema.shareLinks).where(eq(schema.shareLinks.id, id)).run();
}

export function countLink(id: string, field: 'views' | 'downloads'): void {
	const column = schema.shareLinks[field];
	getDb()
		.update(schema.shareLinks)
		.set({ [field]: sql`${column} + 1` })
		.where(eq(schema.shareLinks.id, id))
		.run();
}
