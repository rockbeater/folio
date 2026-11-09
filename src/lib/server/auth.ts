import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { eq, lt } from 'drizzle-orm';
import { getDb, schema } from './db';
import { hashPassword, randomToken, sha256, verifyPassword } from './crypto';

export const SESSION_COOKIE = 'folio_session';
const SESSION_DAYS = 30;

export interface AdminUser {
	id: string;
	email: string;
}

export function hasAdmin(): boolean {
	return Boolean(getDb().select({ id: schema.users.id }).from(schema.users).limit(1).get());
}

export async function createAdmin(email: string, password: string): Promise<AdminUser> {
	const id = crypto.randomUUID();
	const normalized = email.trim().toLowerCase();
	getDb()
		.insert(schema.users)
		.values({ id, email: normalized, passwordHash: await hashPassword(password) })
		.run();
	return { id, email: normalized };
}

export async function authenticate(email: string, password: string): Promise<AdminUser | null> {
	const user = getDb()
		.select()
		.from(schema.users)
		.where(eq(schema.users.email, email.trim().toLowerCase()))
		.get();
	if (!user) {
		// Spend comparable time so response timing does not reveal valid emails.
		await hashPassword(password);
		return null;
	}
	return (await verifyPassword(password, user.passwordHash)) ? { id: user.id, email: user.email } : null;
}

export async function changePassword(userId: string, password: string): Promise<void> {
	getDb()
		.update(schema.users)
		.set({ passwordHash: await hashPassword(password) })
		.where(eq(schema.users.id, userId))
		.run();
	// Sign out other sessions.
	getDb().delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
}

export function changeEmail(userId: string, email: string): void {
	getDb()
		.update(schema.users)
		.set({ email: email.trim().toLowerCase() })
		.where(eq(schema.users.id, userId))
		.run();
}

export async function checkPassword(userId: string, password: string): Promise<boolean> {
	const user = getDb().select().from(schema.users).where(eq(schema.users.id, userId)).get();
	return Boolean(user && (await verifyPassword(password, user.passwordHash)));
}

function cookieOptions(url: URL) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		// Only mark secure when served over HTTPS, so plain-HTTP LAN installs still work.
		secure: url.protocol === 'https:'
	};
}

export function startSession(cookies: Cookies, url: URL, userId: string): void {
	const token = randomToken();
	const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
	getDb().insert(schema.sessions).values({ id: sha256(token), userId, expiresAt }).run();
	cookies.set(SESSION_COOKIE, token, { ...cookieOptions(url), maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

export function endSession(cookies: Cookies, url: URL): void {
	const token = cookies.get(SESSION_COOKIE);
	if (token) getDb().delete(schema.sessions).where(eq(schema.sessions.id, sha256(token))).run();
	cookies.delete(SESSION_COOKIE, cookieOptions(url));
}

export function sessionUser(cookies: Cookies): AdminUser | null {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;
	const row = getDb()
		.select({ id: schema.users.id, email: schema.users.email, expiresAt: schema.sessions.expiresAt })
		.from(schema.sessions)
		.innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
		.where(eq(schema.sessions.id, sha256(token)))
		.get();
	if (!row || row.expiresAt < Date.now()) return null;
	return { id: row.id, email: row.email };
}

export function purgeExpiredSessions(): void {
	getDb().delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now())).run();
}
