import crypto from 'node:crypto';

/** Time-based one-time passwords (RFC 6238, SHA-1, 6 digits, 30 seconds), as used by authenticator apps. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(data: Buffer): string {
	let bits = 0;
	let value = 0;
	let out = '';
	for (const byte of data) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
	return out;
}

export function base32Decode(input: string): Buffer {
	const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const char of clean) {
		value = (value << 5) | ALPHABET.indexOf(char);
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}

export function generateSecret(): string {
	return base32Encode(crypto.randomBytes(20));
}

export function totp(secret: string, time = Date.now(), step = 30): string {
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / step)));
	const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
	const offset = hmac[hmac.length - 1] & 15;
	const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
	return String(code).padStart(6, '0');
}

/** Accept the current code and the ones just before and after (clock drift). */
export function verifyTotp(secret: string, code: string, time = Date.now()): boolean {
	const given = code.replace(/\s/g, '');
	if (!/^\d{6}$/.test(given)) return false;
	return [-1, 0, 1].some((drift) => {
		const expected = Buffer.from(totp(secret, time + drift * 30_000));
		return crypto.timingSafeEqual(expected, Buffer.from(given));
	});
}

export function otpauthUri(secret: string, account: string, issuer: string): string {
	const label = encodeURIComponent(`${issuer}:${account}`);
	return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Ten recovery codes like "k3m9-x2pq-7hvd" (and their hashes for storage). */
export function recoveryCodes(): { codes: string[]; hashes: string[] } {
	const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
	const codes = Array.from({ length: 10 }, () => {
		const bytes = crypto.randomBytes(12);
		const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
		return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
	});
	return { codes, hashes: codes.map(hashRecoveryCode) };
}

export function hashRecoveryCode(code: string): string {
	return crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}
