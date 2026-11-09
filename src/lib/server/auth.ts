import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { eq, lt } from 'drizzle-orm';
import { getDb, schema } from './db';
import { hashPassword, randomToken, sha256, verifyPassword, readSignedValue, signedValue } from './crypto';
import { hashRecoveryCode, verifyTotp } from './totp';

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

// --- Two-factor login (TOTP) ---------------------------------------------------

const PENDING_COOKIE = 'folio_2fa';
const SETUP_COOKIE = 'folio_2fa_setup';

export function totpSecretOf(userId: string): string | null {
	return getDb().select({ s: schema.users.totpSecret }).from(schema.users).where(eq(schema.users.id, userId)).get()?.s ?? null;
}

export function setTotp(userId: string, secret: string | null, recoveryHashes: string[]): void {
	getDb().update(schema.users).set({ totpSecret: secret, recoveryCodes: recoveryHashes }).where(eq(schema.users.id, userId)).run();
}

/** Check an authenticator code, or use up one of the recovery codes. */
export function verifySecondFactor(userId: string, code: string): boolean {
	const user = getDb().select().from(schema.users).where(eq(schema.users.id, userId)).get();
	if (!user?.totpSecret) return false;
	if (verifyTotp(user.totpSecret, code)) return true;
	const hash = hashRecoveryCode(code);
	if (!user.recoveryCodes.includes(hash)) return false;
	setTotp(user.id, user.totpSecret, user.recoveryCodes.filter((h) => h !== hash));
	return true;
}

/** After the password: remember the user for five minutes while the code is asked for. */
export function startPendingLogin(cookies: Cookies, url: URL, userId: string): void {
	cookies.set(PENDING_COOKIE, signedValue(`${userId}:${Date.now() + 5 * 60_000}`), { ...cookieOptions(url), maxAge: 5 * 60 });
}

export function pendingLogin(cookies: Cookies): string | null {
	const value = readSignedValue(cookies.get(PENDING_COOKIE));
	const [userId, expires] = value?.split(':') ?? [];
	return userId && Number(expires) > Date.now() ? userId : null;
}

export function clearPendingLogin(cookies: Cookies, url: URL): void {
	cookies.delete(PENDING_COOKIE, cookieOptions(url));
}

/** The secret being set up, kept in a signed cookie until the first code is confirmed. */
export function setupSecret(cookies: Cookies, url: URL, userId: string, secret?: string): string | null {
	if (secret) {
		cookies.set(SETUP_COOKIE, signedValue(`${userId}:${secret}`), { ...cookieOptions(url), maxAge: 15 * 60 });
		return secret;
	}
	const value = readSignedValue(cookies.get(SETUP_COOKIE));
	const [id, stored] = value?.split(':') ?? [];
	return id === userId && stored ? stored : null;
}

export function clearSetupSecret(cookies: Cookies, url: URL): void {
	cookies.delete(SETUP_COOKIE, cookieOptions(url));
}
