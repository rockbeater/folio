import { error } from '@sveltejs/kit';
import { backupResponse } from '$lib/server/backup';
import type { RequestHandler } from './$types';

/** Download a backup of /data (database, branding, watermarks, product photos and the signing key). */
export const GET: RequestHandler = ({ locals }) => {
	if (!locals.admin) error(401);
	return backupResponse();
};
