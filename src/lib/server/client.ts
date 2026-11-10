import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import {
	clientPasswordOf,
	getShareGrants,
	getVisitorId,
	hasChosenGuest,
	isClient,
	isExpired,
	isLinkUnlocked,
	isPubliclyVisible,
	isUnlocked,
	today
} from './access';
import { getDb, schema } from './db';
import type { ActivityDetail, ActivityKind, FavoriteList, Gallery, Photo } from './db/schema';
import { getGalleryBySlug, getPhotosBySection, getSections, publicGallery, toPhotoView, toSectionView } from './galleries';
import { activeListId, getListByToken, listPhotoIds, listViews, memberships } from './lists';
import { getPreferences, getStudio } from './settings';
import { isLinkOpen } from './shares';
import { bannerCoupon } from './store/catalog';
import { getWatermark, watermarkKey } from './watermarks';
import { normalizeAccess, normalizeDesign, normalizeOptions, type ListView, type Role } from '$lib/types';

export interface ViewerContext {
	cookies: Cookies;
	isAdmin: boolean;
}

export { isExpired, today };

/**
 * What a visitor gets to see:
 * - `expired`: the gallery passed its expiry date
 * - `choose`: client access is on, and the visitor picks "guest" or "client" first
 * - `locked`: the gallery password is needed
 * - `register`: the visitor must enter an email first
 * - `open`: the gallery itself
 */
export type ClientState = 'expired' | 'choose' | 'locked' | 'register' | 'open';

export function roleFor(gallery: Gallery, cookies: Cookies, isAdmin: boolean): Role {
	if (isAdmin) return 'owner';
	return isClient(cookies, gallery) ? 'client' : 'guest';
}

/** Load a gallery for a client page, or 404 if the viewer may not see it at all. */
export function loadClientGallery(slug: string, { cookies, isAdmin }: ViewerContext): { gallery: Gallery; state: ClientState; role: Role } {
	const gallery = getGalleryBySlug(slug);
	if (!gallery) error(404, 'not-found');
	const role = roleFor(gallery, cookies, isAdmin);
	if (isAdmin) return { gallery, state: 'open', role };
	if (gallery.status !== 'published' || gallery.missing) error(404, 'not-found');
	if (isExpired(gallery)) return { gallery, state: 'expired', role };
	if (role !== 'client' && clientPasswordOf(gallery) && !hasChosenGuest(cookies, gallery.id)) return { gallery, state: 'choose', role };
	// A logged-in client has entered the client password, which also opens the gallery.
	if (role !== 'client' && !isUnlocked(cookies, gallery)) return { gallery, state: 'locked', role };
	if (normalizeOptions(gallery.options).emailRegistration && !getVisitorId(cookies, gallery.id)) {
		return { gallery, state: 'register', role };
	}
	return { gallery, state: 'open', role };
}

/** Like loadClientGallery, but fails unless the gallery is open to this viewer. */
export function requireOpenGallery(slug: string, viewer: ViewerContext): { gallery: Gallery; role: Role } {
	const { gallery, state, role } = loadClientGallery(slug, viewer);
	if (state !== 'open') error(403, state);
	return { gallery, role };
}

/** A favorite list shared by link, if the token is valid for this gallery and sharing is allowed. */
export function sharedListFor(gallery: Gallery, token: string | null): FavoriteList | null {
	if (!token) return null;
	const list = getListByToken(token);
	if (!list || list.galleryId !== gallery.id) return null;
	if (!isPubliclyVisible(gallery) || !normalizeAccess(gallery.access).listSharing) return null;
	return list;
}

/**
 * An open share leads on to the gallery, so it needs the gallery password like the gallery does;
 * a private share shows only the list and needs nothing.
 */
export function isListLocked(cookies: Cookies, gallery: Gallery, list: FavoriteList, isAdmin: boolean): boolean {
	return !list.sharePrivate && !isAdmin && !isUnlocked(cookies, gallery) && !isClient(cookies, gallery);
}

export interface ShopAccess {
	gallery: Gallery;
	role: Role;
	/** Photos this viewer may buy. */
	canSee: (p: Photo) => boolean;
	/** Set when the viewer shops from a shared favorite list instead of the gallery. */
	list: FavoriteList | null;
}

/**
 * Who may use the cart: viewers of the open gallery, and people a favorite list was shared with
 * (they may buy the photos of that list only). Whether the store is on is checked by the caller.
 */
export function shopAccess(slug: string, viewer: ViewerContext, share: string | null): ShopAccess | null {
	const { gallery, state, role } = loadClientGallery(slug, viewer);
	if (state === 'open') return { gallery, role, canSee: photoFilter(gallery, role), list: null };
	if (state === 'expired') return null;
	const list = sharedListFor(gallery, share);
	if (!list || isListLocked(viewer.cookies, gallery, list, viewer.isAdmin)) return null;
	const ids = new Set(listPhotoIds(list.id));
	const guest = photoFilter(gallery, 'guest');
	return { gallery, role: 'guest', canSee: (p) => ids.has(p.id) && guest(p), list };
}

/** The list's own name, or the name of the predefined list it belongs to. */
export function sharedListName(gallery: Gallery, list: FavoriteList): string {
	const preset = list.presetId ? normalizeAccess(gallery.access).lists.find((p) => p.id === list.presetId) : undefined;
	return preset?.name ?? list.name;
}

/**
 * For endpoints used both inside the gallery and from a shared list page:
 * a valid share token gives guest access to that list only.
 */
export function requireGalleryOrShare(
	slug: string,
	viewer: ViewerContext,
	share: string | null
): { gallery: Gallery; role: Role; list: FavoriteList | null } {
	if (share) {
		const gallery = getGalleryBySlug(slug);
		const list = gallery ? sharedListFor(gallery, share) : null;
		if (gallery && list) return { gallery, role: viewer.isAdmin ? 'owner' : 'guest', list };
	}
	return { ...requireOpenGallery(slug, viewer), list: null };
}

/**
 * Which photos a role may see. Guests never see photos the client marked
 * private, nor sections reserved for the client.
 */
export function photoFilter(gallery: Pick<Gallery, 'access'>, role: Role): (p: Photo) => boolean {
	const access = normalizeAccess(gallery.access);
	const clientOnly = new Set(access.clientEnabled ? access.clientSections : []);
	return (p) => p.status === 'ready' && !p.hidden && (role !== 'guest' || (!p.private && !clientOnly.has(p.sectionId)));
}

export interface VisitorInfo {
	id: string | null;
	email: string | null;
	/** Photos in any of the visitor's lists (the filled hearts). */
	favorites: string[];
	/** Photo id -> the lists it is in. */
	memberships: Record<string, string[]>;
	lists: ListView[];
	/** The list shown on the favorites page. */
	activeListId: string | null;
}

const NO_VISITOR: VisitorInfo = { id: null, email: null, favorites: [], memberships: {}, lists: [], activeListId: null };

export function visitorInfo(cookies: Cookies, gallery: Gallery): VisitorInfo {
	const visitorId = getVisitorId(cookies, gallery.id);
	if (!visitorId) return NO_VISITOR;
	const visitor = getDb()
		.select()
		.from(schema.visitors)
		.where(and(eq(schema.visitors.id, visitorId), eq(schema.visitors.galleryId, gallery.id)))
		.get();
	if (!visitor) return NO_VISITOR;
	const listId = activeListId(cookies, gallery, visitor.id);
	const byPhoto = memberships(visitor.id);
	return {
		id: visitor.id,
		email: visitor.email,
		favorites: Object.keys(byPhoto),
		memberships: byPhoto,
		lists: listViews(gallery, visitor.id),
		activeListId: listId
	};
}

export function recordActivity(
	galleryId: string,
	kind: ActivityKind,
	email: string | null,
	detail: ActivityDetail | null = null,
	ip: string | null = null
): void {
	getDb().insert(schema.activity).values({ id: crypto.randomUUID(), galleryId, kind, email, detail, ip }).run();
}

/** The watermark key clients see for this gallery (null: no watermark). */
export function galleryWatermarkKey(gallery: Pick<Gallery, 'watermarkId'>): string | null {
	return watermarkKey(getWatermark(gallery.watermarkId));
}

/**
 * The photo shown behind the entry screens (choose, password, register). Like the gallery's
 * cover, it may be seen before the gallery is opened, so it is always a photo guests may see.
 */
export function gateCoverPhoto(gallery: Gallery): Photo | undefined {
	const guest = photoFilter(gallery, 'guest');
	const all = [...getPhotosBySection(gallery.id).values()].flat();
	return all.find((p) => p.id === gallery.coverPhotoId && guest(p)) ?? all.find(guest);
}

export function gateCover(gallery: Gallery) {
	const photo = gateCoverPhoto(gallery);
	return {
		photo: photo ? toPhotoView(photo, galleryWatermarkKey(gallery)) : null,
		placeholder: photo?.placeholder ?? null,
		color: photo?.color ?? null,
		focalX: gallery.coverFocalX,
		focalY: gallery.coverFocalY
	};
}

/** Everything the client layout needs: gallery, sections, cover and visitor state. */
export function galleryShell(gallery: Gallery, cookies: Cookies, role: Role, designOverride: string | null) {
	const isAdmin = role === 'owner';
	const wmKey = galleryWatermarkKey(gallery);
	const canSee = photoFilter(gallery, role);
	const access = normalizeAccess(gallery.access);
	const clientOnly = new Set(access.clientEnabled ? access.clientSections : []);
	const bySection = getPhotosBySection(gallery.id);
	const sections = getSections(gallery.id)
		.map((s) => toSectionView(s, (bySection.get(s.id) ?? []).filter(canSee).length, clientOnly.has(s.id)))
		.filter((s) => s.count > 0);

	let cover = null;
	const all = [...bySection.values()].flat();
	const guestVisible = photoFilter(gallery, 'guest');
	// The cover is shown before login, so it is always a photo guests may see.
	const coverPhoto = all.find((p) => p.id === gallery.coverPhotoId && guestVisible(p)) ?? all.find(guestVisible) ?? all.find(canSee);
	if (coverPhoto) cover = { ...toPhotoView(coverPhoto, wmKey), placeholder: coverPhoto.placeholder };

	const pg = publicGallery(gallery, role);
	if (isAdmin && designOverride) {
		try {
			pg.design = normalizeDesign({ ...pg.design, ...JSON.parse(designOverride) });
		} catch {
			// ignore malformed preview overrides
		}
	}

	return {
		gallery: pg,
		sections,
		cover,
		visitor: visitorInfo(cookies, gallery),
		isAdmin,
		/** Rendered inside the design preview in the admin. */
		isPreview: isAdmin && Boolean(designOverride),
		pending: all.filter((p) => p.status === 'pending' && !p.hidden).length,
		totalPhotos: all.filter(canSee).length
	};
}

export function studioForClients() {
	const studio = getStudio();
	return {
		name: studio.name,
		email: studio.email,
		phone: studio.phone,
		website: studio.website,
		logo: studio.logo ? `/branding/${studio.logo}` : null,
		coverLogo: studio.coverLogo ? `/branding/${studio.coverLogo}` : null
	};
}

/** The announcement banner for a gallery, if one is set up and enabled. */
export function bannerFor(gallery: Gallery, storeOpen = false): { text: string; code: string } | null {
	if (!normalizeOptions(gallery.options).banner) return null;
	// A coupon marked as banner wins over the general announcement while the gallery's store is open.
	const coupon = storeOpen ? bannerCoupon(gallery.id) : null;
	if (coupon) return { text: coupon.description.trim() || coupon.name, code: coupon.code };
	const { banner } = getPreferences();
	if (!banner.enabled || !banner.text.trim()) return null;
	return { text: banner.text.trim(), code: banner.code.trim() };
}

/** Photos of one section this role may see, as client views. */
export function sectionPhotos(gallery: Gallery, sectionId: string, role: Role) {
	const wmKey = galleryWatermarkKey(gallery);
	const canSee = photoFilter(gallery, role);
	return (getPhotosBySection(gallery.id).get(sectionId) ?? []).filter(canSee).map((p) => toPhotoView(p, wmKey));
}

/** The given photos in the given order, limited to what this role may see. */
export function photosInOrder(gallery: Gallery, ids: string[], role: Role) {
	if (ids.length === 0) return [];
	const wmKey = galleryWatermarkKey(gallery);
	const canSee = photoFilter(gallery, role);
	const byId = new Map(photosByIds(gallery.id, ids).map((p) => [p.id, p]));
	return ids.map((id) => byId.get(id)).filter((p): p is Photo => Boolean(p) && canSee(p!)).map((p) => toPhotoView(p, wmKey));
}

export function photosByIds(galleryId: string, ids: string[]) {
	if (ids.length === 0) return [];
	return getDb()
		.select()
		.from(schema.photos)
		.where(and(eq(schema.photos.galleryId, galleryId), inArray(schema.photos.id, ids)))
		.all();
}

/** Photos a quick share link may show: the selected ones, minus hidden and client-private photos. */
export function linkPhotoFilter(p: Photo): boolean {
	return p.status === 'ready' && !p.hidden && !p.private;
}

/**
 * Whether this browser may see a photo through a shared favorite list or a
 * quick share link it has opened (for /img requests outside the gallery).
 */
export function canSeeSharedPhoto(cookies: Cookies, gallery: Gallery, photo: Photo): boolean {
	const grants = getShareGrants(cookies);
	if (grants.length === 0) return false;
	const db = getDb();
	if (linkPhotoFilter(photo)) {
		const links = db.select().from(schema.shareLinks).where(inArray(schema.shareLinks.id, grants)).all();
		for (const link of links) {
			if (link.galleryId === gallery.id && isLinkOpen(link) && isLinkUnlocked(cookies, link) && link.photoIds.includes(photo.id)) return true;
		}
	}
	if (!isPubliclyVisible(gallery) || !photoFilter(gallery, 'guest')(photo)) return false;
	if (!normalizeAccess(gallery.access).listSharing) return false;
	const lists = db
		.select({ id: schema.favoriteLists.id })
		.from(schema.favoriteLists)
		.where(and(inArray(schema.favoriteLists.id, grants), eq(schema.favoriteLists.galleryId, gallery.id), isNotNull(schema.favoriteLists.shareToken)))
		.all()
		.map((l) => l.id);
	if (lists.length === 0) return false;
	return Boolean(
		db
			.select({ photoId: schema.favorites.photoId })
			.from(schema.favorites)
			.where(and(inArray(schema.favorites.listId, lists), eq(schema.favorites.photoId, photo.id)))
			.get()
	);
}
