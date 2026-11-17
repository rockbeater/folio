import { getAdminIps, getPreferences, saveAdminIps } from './settings';

/**
 * Who is looking: the visitor's IP address, and whether the visit should be counted.
 * Visits, downloads and link views from the admin (also in a private window, so from an
 * IP address the admin has used in the last 30 days) are not counted.
 */

const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^::1$/, /^fc/i, /^fd/i, /^::ffff:(127|10|192\.168)\./, /^::ffff:172\.(1[6-9]|2\d|3[01])\./];

export function isPrivateAddress(ip: string): boolean {
	return PRIVATE.some((re) => re.test(ip));
}

/**
 * The client IP. Forwarding headers are only trusted when the request comes from a local reverse
 * proxy. In X-Forwarded-For the last address is the one the proxy itself added: the ones before it
 * come from the client and can be made up, so they are never used (rate limits rely on this).
 */
export function clientIp(request: Request, getClientAddress: () => string): string {
	let peer = '';
	try {
		peer = getClientAddress();
	} catch {
		peer = '';
	}
	if (peer && !isPrivateAddress(peer)) return peer;
	const h = request.headers;
	const xff = h.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).at(-1);
	const forwarded = xff ?? h.get('x-real-ip')?.trim() ?? h.get('cf-connecting-ip')?.trim();
	return forwarded && /^[0-9a-f.:]{3,45}$/i.test(forwarded) ? forwarded : peer;
}

const DAY = 24 * 60 * 60 * 1000;
let cache: Record<string, number> | null = null;
let savedAt = 0;

function adminIps(): Record<string, number> {
	cache ??= getAdminIps();
	return cache;
}

/** Remember the IP addresses the logged-in admin uses (saved at most every ten minutes per address). */
export function noteAdminIp(ip: string): void {
	if (!ip) return;
	const ips = adminIps();
	const now = Date.now();
	const isNew = !(ip in ips);
	ips[ip] = now;
	if (isNew || now - savedAt > 10 * 60 * 1000) {
		for (const [k, seen] of Object.entries(ips)) if (now - seen > 30 * DAY) delete ips[k];
		saveAdminIps(ips);
		savedAt = now;
	}
}

export function recentAdminIps(): { ip: string; lastSeen: number }[] {
	const now = Date.now();
	return Object.entries(adminIps())
		.filter(([, seen]) => now - seen <= 30 * DAY)
		.map(([ip, lastSeen]) => ({ ip, lastSeen }))
		.sort((a, b) => b.lastSeen - a.lastSeen);
}

export function forgetAdminIps(): void {
	cache = {};
	saveAdminIps({});
}

/** Count this visitor in statistics? Not the admin, and not from an address the admin uses. */
export function shouldTrack(locals: App.Locals): boolean {
	if (locals.admin) return false;
	if (!getPreferences().ignoreAdminIps || !locals.ip) return true;
	const seen = adminIps()[locals.ip];
	return !(seen && Date.now() - seen <= 30 * DAY);
}
