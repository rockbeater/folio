import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

// A fresh installation has no admin yet, and whoever opens /setup first creates one. So setup asks
// for a one-time code that only the person running the server can see: it is printed in the log
// and saved as setup-code.txt in the data folder. The file is removed once the admin exists.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let announced = false;

function file(): string {
	return path.join(config.dataDir, 'setup-code.txt');
}

function newCode(): string {
	const chars = Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]);
	return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

/** The current setup code, created (and printed in the log) the first time it is needed. */
export function setupCode(): string {
	let code = '';
	try {
		code = fs.readFileSync(file(), 'utf8').trim();
	} catch {
		code = '';
	}
	if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
		code = newCode();
		fs.mkdirSync(config.dataDir, { recursive: true });
		fs.writeFileSync(file(), `${code}\n`, { mode: 0o600 });
	}
	if (!announced) {
		announced = true;
		console.log(`[folio] setup code: ${code} (also in ${file()}). Enter it on the setup page to create the admin account.`);
	}
	return code;
}

const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function isSetupCode(value: string): boolean {
	const a = crypto.createHash('sha256').update(normalize(value)).digest();
	const b = crypto.createHash('sha256').update(normalize(setupCode())).digest();
	return crypto.timingSafeEqual(a, b);
}

export function clearSetupCode(): void {
	fs.rmSync(file(), { force: true });
}
