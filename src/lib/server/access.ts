import type { Cookies } from '@sveltejs/kit';
import type { Gallery } from './db/schema';
import { readSignedValue, sign, signedValue } from './crypto';

const DAY = 24 * 60 * 60;

function cookieOptions(url: URL, maxAgeDays = 30) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		maxAge: maxAgeDays * DAY
	};
}

function passwordCookie(galleryId: string): string {
	return `fg_${galleryId}`;
}

function visitorCookie(galleryId: string): string {
	return `fv_${galleryId}`;
}

/** Changing the gallery password changes the token, which locks out old visitors. */
function passwordToken(gallery: Pick<Gallery, 'id' | 'password'>): string {
	return sign(`gallery:${gallery.id}:${gallery.password ?? ''}`);
}

export function isUnlocked(cookies: Cookies, gallery: Pick<Gallery, 'id' | 'password'>): boolean {
	if (!gallery.password) return true;
	return cookies.get(passwordCookie(gallery.id)) === passwordToken(gallery);
}

export function unlockGallery(cookies: Cookies, url: URL, gallery: Pick<Gallery, 'id' | 'password'>): void {
	cookies.set(passwordCookie(gallery.id), passwordToken(gallery), cookieOptions(url));
}

/** Clients see published galleries whose folder exists; the owner sees everything. */
export function isPubliclyVisible(gallery: Pick<Gallery, 'status' | 'missing'>): boolean {
	return gallery.status === 'published' && !gallery.missing;
}

export function canViewGallery(
	gallery: Pick<Gallery, 'id' | 'password' | 'status' | 'missing'>,
	cookies: Cookies,
	isAdmin: boolean
): boolean {
	return isAdmin || (isPubliclyVisible(gallery) && isUnlocked(cookies, gallery));
}

export function getVisitorId(cookies: Cookies, galleryId: string): string | null {
	const value = readSignedValue(cookies.get(visitorCookie(galleryId)));
	return value?.startsWith(`${galleryId}:`) ? value.slice(galleryId.length + 1) : null;
}

export function setVisitorId(cookies: Cookies, url: URL, galleryId: string, visitorId: string): void {
	cookies.set(visitorCookie(galleryId), signedValue(`${galleryId}:${visitorId}`), cookieOptions(url, 365));
}
