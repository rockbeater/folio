import { listNotifications, NOTIFICATION_KINDS, type NotificationKind } from '$lib/server/notifications';
import { getActivitySeenAt } from '$lib/server/settings';
import type { PageServerLoad } from './$types';

const PAGE = 50;

export const load: PageServerLoad = ({ url }) => {
	const kind = url.searchParams.get('kind');
	const kinds = NOTIFICATION_KINDS.includes(kind as NotificationKind) ? [kind as NotificationKind] : undefined;
	const before = Number(url.searchParams.get('before')) || undefined;
	// One extra tells whether there is an older page.
	const items = listNotifications({ before, limit: PAGE + 1, kinds });
	return {
		kind: kinds?.[0] ?? null,
		items: items.slice(0, PAGE),
		hasMore: items.length > PAGE,
		seenAt: getActivitySeenAt()
	};
};
