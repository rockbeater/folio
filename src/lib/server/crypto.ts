import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from './config';

const scrypt = promisify(crypto.scrypt) as (
	password: string,
	salt: Buffer,
	keylen: number,
	options: crypto.ScryptOptions
) => Promise<Buffer>;

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.randomBytes(16);
	const hash = await scrypt(password, salt, 64, SCRYPT);
	return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [algo, n, r, p, saltB64, hashB64] = stored.split('$');
	if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
	const expected = Buffer.from(hashB64, 'base64url');
	const actual = await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length, {
		N: Number(n),
		r: Number(r),
		p: Number(p),
		maxmem: SCRYPT.maxmem
	});
	return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function randomToken(bytes = 32): string {
	return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
	return crypto.createHash('sha256').update(value).digest('base64url');
}

let secret: Buffer | null = null;

/** Forget the cached secret (after a restore replaced secret.key). */
export function resetAppSecret(): void {
	secret = null;
}

/** Per-installation secret used to sign cookies. Created on first start in the data folder. */
export function appSecret(): Buffer {
	if (secret) return secret;
	const file = path.join(config.dataDir, 'secret.key');
	try {
		secret = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64url');
	} catch {
		fs.mkdirSync(config.dataDir, { recursive: true });
		secret = crypto.randomBytes(32);
		fs.writeFileSync(file, secret.toString('base64url'), { mode: 0o600 });
	}
	return secret;
}

export function sign(value: string): string {
	return crypto.createHmac('sha256', appSecret()).update(value).digest('base64url');
}

export function verifySignature(value: string, signature: string): boolean {
	const expected = Buffer.from(sign(value));
	const actual = Buffer.from(signature);
	return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** "value.signature" helpers for signed cookies. */
export function signedValue(value: string): string {
	return `${value}.${sign(value)}`;
}

export function readSignedValue(cookie: string | undefined): string | null {
	if (!cookie) return null;
	const dot = cookie.lastIndexOf('.');
	if (dot <= 0) return null;
	const value = cookie.slice(0, dot);
	return verifySignature(value, cookie.slice(dot + 1)) ? value : null;
}

/** Human-friendly random password for galleries (no look-alike characters). */
export function generateGalleryPassword(length = 8): string {
	const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
	const bytes = crypto.randomBytes(length);
	let out = '';
	for (const b of bytes) out += alphabet[b % alphabet.length];
	return out;
}
