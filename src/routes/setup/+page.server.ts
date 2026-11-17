import { fail, redirect } from '@sveltejs/kit';
import { createFirstAdmin, hasAdmin, startSession } from '$lib/server/auth';
import { noteFailure, rateLimit, tooManyFailures } from '$lib/server/ratelimit';
import { savePreferences, saveStudio } from '$lib/server/settings';
import { clearSetupCode, isSetupCode, setupCode } from '$lib/server/setup';
import { ensureDefaultTemplates } from '$lib/server/mail/templates';
import { SUPPORTED_LANGUAGES } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (hasAdmin()) redirect(303, '/admin/login');
	setupCode(); // make sure there is one, and that it is in the log
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOUR = 60 * 60 * 1000;

export const actions: Actions = {
	default: async ({ request, cookies, url, locals }) => {
		if (hasAdmin()) redirect(303, '/admin/login');
		const form = await request.formData();
		const studioName = String(form.get('studioName') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const repeat = String(form.get('repeat') ?? '');
		const code = String(form.get('code') ?? '');
		const language = String(form.get('language') ?? 'en');
		const keep = { studioName, email, language };

		if (tooManyFailures('setup-fail', 50) || !rateLimit(`setup:${locals.ip}`, 10, 15 * 60 * 1000)) {
			return fail(429, { errors: { code: 'admin.login.tooMany' }, ...keep });
		}
		const errors: Record<string, string> = {};
		if (!isSetupCode(code)) errors.code = 'admin.setup.errCode';
		if (!studioName) errors.studioName = 'admin.setup.errName';
		if (!EMAIL.test(email)) errors.email = 'admin.setup.errEmail';
		if (password.length < 10) errors.password = 'admin.setup.errPassword';
		else if (password !== repeat) errors.repeat = 'admin.setup.errRepeat';
		if (errors.code) noteFailure('setup-fail', HOUR);
		if (Object.keys(errors).length > 0) return fail(400, { errors, ...keep });

		const lang = (SUPPORTED_LANGUAGES as readonly string[]).includes(language) ? language : 'en';
		const user = await createFirstAdmin(email, password);
		if (!user) redirect(303, '/admin/login');
		clearSetupCode();
		saveStudio({ name: studioName, email: user.email, language: lang });
		savePreferences({ defaultLanguage: lang });
		ensureDefaultTemplates(lang);
		startSession(cookies, url, user.id);
		redirect(303, '/admin');
	}
};
