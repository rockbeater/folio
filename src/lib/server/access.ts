import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import type { Gallery, ShareLink } from './db/schema';
import { normalizeAccess } from '$lib/types';
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

/** Today's date (YYYY-MM-DD) in the server's time zone (TZ). */
export function today(): string {
	return new Date().toLocaleDateString('sv-SE');
}

/** A gallery is visible until the end of its expiry day. */
export function isExpired(gallery: Pick<Gallery, 'expiresOn'>, date = today()): boolean {
	return Boolean(gallery.expiresOn && gallery.expiresOn < date);
}

/** Clients see published, unexpired galleries whose folder exists; the owner sees everything. */
export function isPubliclyVisible(gallery: Pick<Gallery, 'status' | 'missing' | 'expiresOn'>): boolean {
	return gallery.status === 'published' && !gallery.missing && !isExpired(gallery);
}

export function canViewGallery(
	gallery: Pick<Gallery, 'id' | 'password' | 'status' | 'missing' | 'expiresOn'>,
	cookies: Cookies,
	isAdmin: boolean
): boolean {
	return isAdmin || (isPubliclyVisible(gallery) && isUnlocked(cookies, gallery));
}

function pinCookie(galleryId: string): string {
	return `fp_${galleryId}`;
}

/** True when no PIN is set, or the visitor has entered the current PIN. */
export function isPinUnlocked(cookies: Cookies, galleryId: string, pin: string | null): boolean {
	if (!pin) return true;
	return cookies.get(pinCookie(galleryId)) === sign(`pin:${galleryId}:${pin}`);
}

export function unlockPin(cookies: Cookies, url: URL, galleryId: string, pin: string): void {
	cookies.set(pinCookie(galleryId), sign(`pin:${galleryId}:${pin}`), cookieOptions(url));
}

export function getVisitorId(cookies: Cookies, galleryId: string): string | null {
	const value = readSignedValue(cookies.get(visitorCookie(galleryId)));
	return value?.startsWith(`${galleryId}:`) ? value.slice(galleryId.length + 1) : null;
}

export function setVisitorId(cookies: Cookies, url: URL, galleryId: string, visitorId: string): void {
	cookies.set(visitorCookie(galleryId), signedValue(`${galleryId}:${visitorId}`), cookieOptions(url, 365));
}

/** Constant-time comparison of two passwords. */
export function samePassword(a: string, b: string): boolean {
	const x = crypto.createHash('sha256').update(a).digest();
	const y = crypto.createHash('sha256').update(b).digest();
	return crypto.timingSafeEqual(x, y);
}

function clientCookie(galleryId: string): string {
	return `fc_${galleryId}`;
}

/** Changing the client password logs the client out everywhere. */
function clientToken(galleryId: string, password: string): string {
	return sign(`client:${galleryId}:${password}`);
}

/** The client password of a gallery, or null when client access is off. */
export function clientPasswordOf(gallery: Pick<Gallery, 'access'>): string | null {
	const access = normalizeAccess(gallery.access);
	return access.clientEnabled ? access.clientPassword : null;
}

export function isClient(cookies: Cookies, gallery: Pick<Gallery, 'id' | 'access'>): boolean {
	const password = clientPasswordOf(gallery);
	return Boolean(password) && cookies.get(clientCookie(gallery.id)) === clientToken(gallery.id, password!);
}

export function loginClient(cookies: Cookies, url: URL, gallery: Pick<Gallery, 'id' | 'access'>): void {
	const password = clientPasswordOf(gallery);
	if (password) cookies.set(clientCookie(gallery.id), clientToken(gallery.id, password), cookieOptions(url));
}

export function logoutClient(cookies: Cookies, gallery: Pick<Gallery, 'id'>): void {
	cookies.delete(clientCookie(gallery.id), { path: '/' });
}

const GRANTS = 'fsh';

/** Ids of shared lists and quick share links this browser has opened. */
export function getShareGrants(cookies: Cookies): string[] {
	const value = readSignedValue(cookies.get(GRANTS));
	return value ? value.split(',').filter(Boolean) : [];
}

export function addShareGrant(cookies: Cookies, url: URL, id: string): void {
	const grants = getShareGrants(cookies).filter((g) => g !== id);
	grants.unshift(id);
	cookies.set(GRANTS, signedValue(grants.slice(0, 20).join(',')), cookieOptions(url, 90));
}

function linkCookie(linkId: string): string {
	return `fq_${linkId}`;
}

export function isLinkUnlocked(cookies: Cookies, link: Pick<ShareLink, 'id' | 'password'>): boolean {
	if (!link.password) return true;
	return cookies.get(linkCookie(link.id)) === sign(`link:${link.id}:${link.password}`);
}

export function unlockLink(cookies: Cookies, url: URL, link: Pick<ShareLink, 'id' | 'password'>): void {
	cookies.set(linkCookie(link.id), sign(`link:${link.id}:${link.password ?? ''}`), cookieOptions(url));
}

function guestChoiceCookie(galleryId: string): string {
	return `fa_${galleryId}`;
}

/** With client access on, visitors first choose "guest" or "client"; this remembers "guest". */
export function hasChosenGuest(cookies: Cookies, galleryId: string): boolean {
	return cookies.get(guestChoiceCookie(galleryId)) === '1';
}

export function chooseGuest(cookies: Cookies, url: URL, galleryId: string): void {
	cookies.set(guestChoiceCookie(galleryId), '1', cookieOptions(url));
}

export function clearGuestChoice(cookies: Cookies, galleryId: string): void {
	cookies.delete(guestChoiceCookie(galleryId), { path: '/' });
}
