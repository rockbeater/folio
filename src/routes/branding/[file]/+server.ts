import fs from 'node:fs';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { config } from '$lib/server/config';
import { getStudio } from '$lib/server/settings';
import type { RequestHandler } from './$types';

const TYPES: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml'
};

export const GET: RequestHandler = async ({ params }) => {
	const studio = getStudio();
	const allowed = new Set([studio.logo, 'logo.png'].filter(Boolean));
	if (!studio.logo || !allowed.has(params.file)) error(404);
	const file = path.join(config.dataDir, 'branding', path.basename(params.file));
	const data = await fs.promises.readFile(file).catch(() => null);
	if (!data) error(404);
	return new Response(data, {
		headers: {
			'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
			'cache-control': 'public, max-age=300',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'"
		}
	});
};
