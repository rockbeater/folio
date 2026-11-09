import fs from 'node:fs/promises';
import path from 'node:path';
import { fail } from '@sveltejs/kit';
import sharp from 'sharp';
import { changeEmail, changePassword, checkPassword } from '$lib/server/auth';
import { config } from '$lib/server/config';
import { deleteTemplate, listTemplates, saveTemplate, setDefaultTemplate } from '$lib/server/mail/templates';
import { sendTestEmail } from '$lib/server/mail/send';
import { getSmtp, getStudio, isSmtpConfigured, saveSmtp, saveStudio, type SmtpSecurity } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGO_TYPES: Record<string, string> = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/webp': '.webp',
	'image/svg+xml': '.svg'
};

export const load: PageServerLoad = ({ locals }) => {
	const smtp = getSmtp();
	return {
		studio: getStudio(),
		smtp: { ...smtp, pass: '', hasPass: Boolean(smtp.pass) },
		smtpFromEnv: config.smtpFromEnv,
		smtpConfigured: isSmtpConfigured(smtp),
		templates: listTemplates(),
		account: { email: locals.admin!.email }
	};
};

export const actions: Actions = {
	branding: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (email && !EMAIL.test(email)) return fail(400, { tab: 'branding', error: 'admin.setup.errEmail' });
		const update = {
			name: String(form.get('name') ?? '').trim(),
			email,
			phone: String(form.get('phone') ?? '').trim(),
			website: String(form.get('website') ?? '').trim()
		};
		if (!update.name) return fail(400, { tab: 'branding', error: 'admin.setup.errName' });

		const brandingDir = path.join(config.dataDir, 'branding');
		const logo = form.get('logo');
		let logoName = getStudio().logo;
		if (form.get('removeLogo') === 'on') logoName = null;
		if (logo instanceof File && logo.size > 0) {
			const ext = LOGO_TYPES[logo.type];
			if (!ext || logo.size > 5 * 1024 * 1024) return fail(400, { tab: 'branding', error: 'common.error' });
			await fs.mkdir(brandingDir, { recursive: true });
			const data = Buffer.from(await logo.arrayBuffer());
			logoName = `logo-${Date.now()}${ext}`;
			await fs.writeFile(path.join(brandingDir, logoName), data);
			// PNG version for emails (many email clients cannot show SVG or WebP).
			await sharp(data, { density: 300 })
				.resize({ height: 200, width: 800, fit: 'inside', withoutEnlargement: true })
				.png()
				.toFile(path.join(brandingDir, 'logo.png'));
		}
		saveStudio({ ...update, logo: logoName });
		return { tab: 'branding', saved: true };
	},

	smtp: async ({ request }) => {
		if (config.smtpFromEnv) return fail(400, { tab: 'email' });
		const form = await request.formData();
		const security = String(form.get('security') ?? 'starttls') as SmtpSecurity;
		const pass = String(form.get('pass') ?? '');
		saveSmtp({
			host: String(form.get('host') ?? '').trim(),
			port: Number(form.get('port')) || 587,
			security: ['starttls', 'tls', 'none'].includes(security) ? security : 'starttls',
			user: String(form.get('user') ?? '').trim(),
			...(pass ? { pass } : {}),
			fromName: String(form.get('fromName') ?? '').trim(),
			fromEmail: String(form.get('fromEmail') ?? '').trim()
		});
		return { tab: 'email', saved: true };
	},

	testSmtp: async ({ locals }) => {
		const to = getStudio().email || locals.admin!.email;
		const result = await sendTestEmail(to);
		return result.ok ? { tab: 'email', testOk: to } : fail(400, { tab: 'email', testError: result.error });
	},

	saveTemplate: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { tab: 'templates', error: 'admin.templates.errName' });
		const kind = form.get('kind') === 'reminder' ? 'reminder' : 'delivery';
		saveTemplate({
			id: String(form.get('id') ?? '') || undefined,
			kind,
			language: String(form.get('language') ?? '') || getStudio().language,
			name,
			subject: String(form.get('subject') ?? '').trim(),
			body: String(form.get('body') ?? '')
		});
		return { tab: 'templates', saved: true };
	},

	defaultTemplate: async ({ request }) => {
		const form = await request.formData();
		setDefaultTemplate(String(form.get('id')));
		return { tab: 'templates', saved: true };
	},

	deleteTemplate: async ({ request }) => {
		const form = await request.formData();
		deleteTemplate(String(form.get('id')));
		return { tab: 'templates', saved: true };
	},

	account: async ({ request, locals }) => {
		const form = await request.formData();
		const user = locals.admin!;
		const current = String(form.get('currentPassword') ?? '');
		if (!(await checkPassword(user.id, current))) return fail(400, { tab: 'account', error: 'admin.account.wrongPassword' });
		const email = String(form.get('email') ?? '').trim();
		if (!EMAIL.test(email)) return fail(400, { tab: 'account', error: 'admin.setup.errEmail' });
		if (email.toLowerCase() !== user.email) changeEmail(user.id, email);
		const next = String(form.get('newPassword') ?? '');
		if (next) {
			if (next.length < 10) return fail(400, { tab: 'account', error: 'admin.setup.errPassword' });
			await changePassword(user.id, next);
		}
		return { tab: 'account', saved: true, relogin: Boolean(next) };
	}
};
