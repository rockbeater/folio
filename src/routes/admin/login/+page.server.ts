import { fail, redirect } from '@sveltejs/kit';
import { authenticate, clearPendingLogin, pendingLogin, startPendingLogin, startSession, totpSecretOf, verifySecondFactor } from '$lib/server/auth';
import { noteFailure, rateLimit, resetRateLimit, tooManyFailures } from '$lib/server/ratelimit';
import { getStudio } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';
import { logger } from '$lib/server/log';

const log = logger('auth');

function safeNext(value: string | null): string {
	return value && value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.admin) redirect(303, safeNext(url.searchParams.get('next')));
	locals.lang = getStudio().language;
	return { language: getStudio().language };
};

export const actions: Actions = {
	login: async ({ request, cookies, url, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const key = `login:${locals.ip}`;
		if (!rateLimit(key, 10, 15 * 60 * 1000)) return fail(429, { email, error: 'admin.login.tooMany' });
		const user = await authenticate(email, password);
		if (!user) {
			log.warn(`failed admin login for "${email}" from ${locals.ip}`);
			return fail(400, { email, error: 'admin.login.wrong' });
		}
		resetRateLimit(key);
		if (totpSecretOf(user.id)) {
			startPendingLogin(cookies, url, user.id);
			return { step: 'totp' as const };
		}
		startSession(cookies, url, user.id);
		redirect(303, safeNext(url.searchParams.get('next')));
	},

	totp: async ({ request, cookies, url, locals }) => {
		const userId = pendingLogin(cookies);
		if (!userId) return fail(400, { error: 'admin.totp.expired' });
		const key = `totp:${locals.ip}`;
		// Codes for one account from all addresses together: only someone with the password gets here.
		const shared = `totp-fail:${userId}`;
		if (tooManyFailures(shared, 20) || !rateLimit(key, 10, 15 * 60 * 1000)) return fail(429, { step: 'totp' as const, error: 'admin.login.tooMany' });
		const code = String((await request.formData()).get('code') ?? '').trim();
		if (!verifySecondFactor(userId, code)) {
			noteFailure(shared, 60 * 60 * 1000);
			log.warn(`wrong two-factor code from ${locals.ip}`);
			return fail(400, { step: 'totp' as const, error: 'admin.totp.wrong' });
		}
		resetRateLimit(key);
		clearPendingLogin(cookies, url);
		startSession(cookies, url, userId);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
