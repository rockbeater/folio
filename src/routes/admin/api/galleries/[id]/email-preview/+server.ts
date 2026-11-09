import { error, json } from '@sveltejs/kit';
import { config } from '$lib/server/config';
import { getGalleryById } from '$lib/server/galleries';
import { mergeFields } from '$lib/server/mail/render';
import { composeGalleryEmail, mergeValuesFor } from '$lib/server/mail/send';
import { createI18n } from '$lib/i18n';
import type { RequestHandler } from './$types';

/** Preview the gallery email, and return the invitation as plain text for SMS or messaging apps. */
export const POST: RequestHandler = async ({ params, request, locals, url }) => {
	if (!locals.admin) error(401);
	const gallery = getGalleryById(params.id);
	if (!gallery) error(404);
	const body = (await request.json().catch(() => ({}))) as { subject?: string; body?: string; includePassword?: boolean };
	const payload = {
		subject: String(body.subject ?? ''),
		body: String(body.body ?? ''),
		includePassword: Boolean(body.includePassword),
		baseUrl: config.baseUrl || url.origin
	};
	const email = await composeGalleryEmail(gallery, payload, true);

	const { t } = createI18n(gallery.language);
	const values = mergeValuesFor(gallery, payload.baseUrl);
	const invitation = [
		mergeFields(payload.body, values).trim(),
		'',
		`${t('email.galleryLink')}: ${values.gallery_link}`,
		payload.includePassword && gallery.password ? `${t('email.password')}: ${gallery.password}` : ''
	]
		.filter((line, i, all) => line !== '' || all[i + 1] !== '')
		.join('\n')
		.trim();
	return json({ subject: email.subject, html: email.html, invitation });
};
