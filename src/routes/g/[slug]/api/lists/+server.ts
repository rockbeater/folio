import { error, json } from '@sveltejs/kit';
import { getVisitorId } from '$lib/server/access';
import { config } from '$lib/server/config';
import { photoFilter, photosByIds, requireOpenGallery, visitorInfo } from '$lib/server/client';
import { createI18n } from '$lib/i18n';
import { createList, deleteList, getList, listPhotoIds, newShareToken, setActiveList, setNote, updateList } from '$lib/server/lists';
import { queueNotice } from '$lib/server/mail/send';
import { getStudio } from '$lib/server/settings';
import { normalizeAccess } from '$lib/types';
import type { RequestHandler } from './$types';

interface Body {
	action?: unknown;
	listId?: unknown;
	name?: unknown;
	photoId?: unknown;
	note?: unknown;
	private?: unknown;
	submitted?: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Manage the visitor's favorite lists: create, rename, delete, switch, submit, share, notes. */
export const POST: RequestHandler = async ({ params, request, cookies, locals, url }) => {
	const { gallery, role } = requireOpenGallery(params.slug, { cookies, isAdmin: Boolean(locals.admin) });
	if (!gallery.favoritesEnabled) error(403);
	const visitorId = getVisitorId(cookies, gallery.id);
	if (!visitorId) error(401, 'email-required');
	const body = (await request.json().catch(() => ({}))) as Body;
	const action = str(body.action);
	const access = normalizeAccess(gallery.access);

	if (action === 'create') {
		const name = str(body.name).trim();
		if (!name) error(400);
		setActiveList(cookies, url, gallery.id, createList(gallery, visitorId, name));
		return json(visitorInfo(cookies, gallery));
	}

	const list = getList(visitorId, str(body.listId));
	if (!list) error(404);
	const own = list.name !== '' && !list.presetId; // the default and predefined lists cannot be renamed or deleted

	switch (action) {
		case 'activate':
			setActiveList(cookies, url, gallery.id, list.id);
			break;
		case 'rename': {
			const name = str(body.name).trim().slice(0, 60);
			if (!own || !name) error(400);
			updateList(list, { name });
			break;
		}
		case 'delete':
			if (!own) error(400);
			deleteList(list);
			break;
		case 'note':
			setNote(list, str(body.photoId), str(body.note));
			break;
		case 'submit': {
			const submitted = body.submitted !== false;
			updateList(list, { submittedAt: submitted ? Date.now() : null });
			if (submitted) {
				const studio = getStudio();
				const { t } = createI18n(studio.language);
				const info = visitorInfo(cookies, gallery);
				const view = info.lists.find((l) => l.id === list.id);
				const listName = view?.name || t('client.lists.default');
				const link = `${config.baseUrl || url.origin}/admin/galleries/${gallery.id}?tab=activity`;
				queueNotice(
					gallery.id,
					studio.email || '',
					t('email.listSubmitted.subject', { gallery: gallery.name }),
					t('email.listSubmitted.body', { email: info.email ?? '', list: listName, count: view?.count ?? 0, gallery: gallery.name, link })
				);
			}
			break;
		}
		case 'share': {
			if (!access.listSharing) error(403);
			updateList(list, {
				shareToken: list.shareToken ?? newShareToken(),
				sharePrivate: typeof body.private === 'boolean' ? body.private : access.privateShareDefault
			});
			break;
		}
		case 'unshare':
			updateList(list, { shareToken: null });
			break;
		default:
			error(400);
	}

	const info = visitorInfo(cookies, gallery);
	// How many photos of the list a guest would not see (private photos, client-only sections).
	const ids = listPhotoIds(list.id);
	const guest = photoFilter(gallery, 'guest');
	const omitted = role === 'guest' ? 0 : photosByIds(gallery.id, ids).filter((p) => !guest(p)).length;
	return json({ ...info, omitted });
};
