import { fail, redirect } from '@sveltejs/kit';
import { createAdmin, hasAdmin, startSession } from '$lib/server/auth';
import { saveStudio } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (hasAdmin()) redirect(303, '/admin/login');
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (hasAdmin()) redirect(303, '/admin/login');
		const form = await request.formData();
		const studioName = String(form.get('studioName') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const repeat = String(form.get('repeat') ?? '');

		const errors: Record<string, string> = {};
		if (!studioName) errors.studioName = 'admin.setup.errName';
		if (!EMAIL.test(email)) errors.email = 'admin.setup.errEmail';
		if (password.length < 10) errors.password = 'admin.setup.errPassword';
		else if (password !== repeat) errors.repeat = 'admin.setup.errRepeat';
		if (Object.keys(errors).length > 0) return fail(400, { errors, studioName, email });

		const user = await createAdmin(email, password);
		saveStudio({ name: studioName, email: user.email });
		startSession(cookies, url, user.id);
		redirect(303, '/admin');
	}
};
