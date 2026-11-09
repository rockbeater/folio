import { error } from '@sveltejs/kit';
import { personalData } from '$lib/server/gdpr';
import type { RequestHandler } from './$types';

/** Export everything stored about an email address as JSON (GDPR access request). */
export const GET: RequestHandler = ({ locals, url }) => {
	if (!locals.admin) error(401);
	const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error(400);
	return new Response(JSON.stringify(personalData(email), null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="folio-data-${email.replace(/[^\w.@-]+/g, '_')}.json"`
		}
	});
};
