import { error, json } from '@sveltejs/kit';
import { config } from '$lib/server/config';
import { getGalleryById } from '$lib/server/galleries';
import { composeGalleryEmail } from '$lib/server/mail/send';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, url }) => {
	if (!locals.admin) error(401);
	const gallery = getGalleryById(params.id);
	if (!gallery) error(404);
	const body = (await request.json().catch(() => ({}))) as { subject?: string; body?: string; includePassword?: boolean };
	const email = await composeGalleryEmail(
		gallery,
		{
			subject: String(body.subject ?? ''),
			body: String(body.body ?? ''),
			includePassword: Boolean(body.includePassword),
			baseUrl: config.baseUrl || url.origin
		},
		true
	);
	return json({ subject: email.subject, html: email.html });
};
