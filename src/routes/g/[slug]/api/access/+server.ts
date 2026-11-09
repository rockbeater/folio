import { error, json } from '@sveltejs/kit';
import { chooseGuest, clearGuestChoice, clientPasswordOf, logoutClient } from '$lib/server/access';
import { getGalleryBySlug } from '$lib/server/galleries';
import type { RequestHandler } from './$types';

/** "Enter as guest" on the entry screen of galleries with client access. */
export const POST: RequestHandler = ({ params, cookies, url }) => {
	const gallery = getGalleryBySlug(params.slug);
	if (!gallery || !clientPasswordOf(gallery)) error(404);
	chooseGuest(cookies, url, gallery.id);
	return json({ ok: true });
};

/** "Back to selection": show the guest/client choice again. */
export const DELETE: RequestHandler = ({ params, cookies }) => {
	const gallery = getGalleryBySlug(params.slug);
	if (!gallery) error(404);
	clearGuestChoice(cookies, gallery.id);
	logoutClient(cookies, gallery);
	return json({ ok: true });
};
