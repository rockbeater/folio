import fs from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { getWatermark, watermarksDir } from '$lib/server/watermarks';
import type { RequestHandler } from './$types';

/** The watermark image, for previews in the admin. */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.admin) error(401);
	const wm = getWatermark(params.id);
	if (!wm) error(404);
	const data = await fs.readFile(path.join(watermarksDir(), path.basename(wm.file))).catch(() => null);
	if (!data) error(404);
	return new Response(data, { headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=60' } });
};
