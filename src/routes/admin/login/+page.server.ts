import { fail, redirect } from '@sveltejs/kit';
import { authenticate, startSession } from '$lib/server/auth';
import { rateLimit, resetRateLimit } from '$lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

function safeNext(value: string | null): string {
	return value && value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.admin) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const key = `login:${getClientAddress()}`;
		if (!rateLimit(key, 10, 15 * 60 * 1000)) return fail(429, { email, error: 'admin.login.tooMany' });
		const user = await authenticate(email, password);
		if (!user) return fail(400, { email, error: 'admin.login.wrong' });
		resetRateLimit(key);
		startSession(cookies, url, user.id);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
