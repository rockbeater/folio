import { json } from '@sveltejs/kit';
import { countNotificationsSince, listNotifications } from '$lib/server/notifications';
import { getActivitySeenAt, setActivitySeenAt } from '$lib/server/settings';
import type { RequestHandler } from './$types';

/** The bell: ?count=1 only counts the new items; otherwise the newest items as well. */
export const GET: RequestHandler = ({ url }) => {
	const seenAt = getActivitySeenAt();
	const unread = countNotificationsSince(seenAt);
	if (url.searchParams.get('count')) return json({ unread });
	return json({ unread, seenAt, items: listNotifications({ limit: 12 }) });
};

/** Mark everything up to now as seen. */
export const POST: RequestHandler = () => {
	setActivitySeenAt(Date.now());
	return json({ ok: true });
};
