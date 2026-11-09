import fs from 'node:fs';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { productImagesDir } from '$lib/server/store/catalog';
import type { RequestHandler } from './$types';

/** Product photos shown in the store. */
export const GET: RequestHandler = async ({ params }) => {
	if (!/^[\w-]+\.webp$/.test(params.file)) error(404);
	const data = await fs.promises.readFile(path.join(productImagesDir(), params.file)).catch(() => null);
	if (!data) error(404);
	return new Response(data, { headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable' } });
};
