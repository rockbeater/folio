import { fail, redirect } from '@sveltejs/kit';
import { authenticate, clearPendingLogin, pendingLogin, startPendingLogin, startSession, totpSecretOf, verifySecondFactor } from '$lib/server/auth';
import { rateLimit, resetRateLimit } from '$lib/server/ratelimit';
import { getStudio } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

function safeNext(value: string | null): string {
	return value && value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.admin) redirect(303, safeNext(url.searchParams.get('next')));
	locals.lang = getStudio().language;
	return { language: getStudio().language };
};

export const actions: Actions = {
	login: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const key = `login:${getClientAddress()}`;
		if (!rateLimit(key, 10, 15 * 60 * 1000)) return fail(429, { email, error: 'admin.login.tooMany' });
		const user = await authenticate(email, password);
		if (!user) return fail(400, { email, error: 'admin.login.wrong' });
		resetRateLimit(key);
		if (totpSecretOf(user.id)) {
			startPendingLogin(cookies, url, user.id);
			return { step: 'totp' as const };
		}
		startSession(cookies, url, user.id);
		redirect(303, safeNext(url.searchParams.get('next')));
	},

	totp: async ({ request, cookies, url, getClientAddress }) => {
		const userId = pendingLogin(cookies);
		if (!userId) return fail(400, { error: 'admin.totp.expired' });
		const key = `totp:${getClientAddress()}`;
		if (!rateLimit(key, 10, 15 * 60 * 1000)) return fail(429, { step: 'totp' as const, error: 'admin.login.tooMany' });
		const code = String((await request.formData()).get('code') ?? '').trim();
		if (!verifySecondFactor(userId, code)) return fail(400, { step: 'totp' as const, error: 'admin.totp.wrong' });
		resetRateLimit(key);
		clearPendingLogin(cookies, url);
		startSession(cookies, url, userId);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
