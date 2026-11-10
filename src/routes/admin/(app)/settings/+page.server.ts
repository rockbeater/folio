import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fail, redirect } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { changeEmail, changePassword, checkPassword, clearSetupSecret, setTotp, setupSecret, totpSecretOf } from '$lib/server/auth';
import { restoreBackup } from '$lib/server/backup';
import { forgetAdminIps, noteAdminIp, recentAdminIps } from '$lib/server/visitors';
import { deletePersonalData, summary } from '$lib/server/gdpr';
import { generateSecret, otpauthUri, recoveryCodes, verifyTotp } from '$lib/server/totp';
import { config } from '$lib/server/config';
import { getDb, schema } from '$lib/server/db';
import type { TemplateKind, TextWatermark } from '$lib/server/db/schema';
import { deleteTemplate, listTemplates, saveTemplate, setDefaultTemplate, TEMPLATE_KINDS } from '$lib/server/mail/templates';
import { sendTestEmail } from '$lib/server/mail/send';
import { deletePreset, listPresets, renamePreset, setDefaultPreset } from '$lib/server/presets';
import {
	getPreferences,
	getSmtp,
	getStudio,
	isSmtpConfigured,
	savePreferences,
	saveSmtp,
	saveStudio,
	type SmtpSecurity
} from '$lib/server/settings';
import { getWatermark, listWatermarks, removeWatermarkFile, saveWatermarkImage } from '$lib/server/watermarks';
import { SUPPORTED_LANGUAGES, WATERMARK_POSITIONS, type WatermarkPosition } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_TYPES: Record<string, string> = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/webp': '.webp',
	'image/svg+xml': '.svg',
	'image/x-icon': '.ico',
	'image/vnd.microsoft.icon': '.ico'
};

const brandingDir = () => path.join(config.dataDir, 'branding');

async function storeBrandingFile(file: File, prefix: string): Promise<string | null> {
	const ext = IMAGE_TYPES[file.type];
	if (!ext || file.size > 5 * 1024 * 1024) return null;
	await fs.mkdir(brandingDir(), { recursive: true });
	const name = `${prefix}-${Date.now()}${ext}`;
	await fs.writeFile(path.join(brandingDir(), name), Buffer.from(await file.arrayBuffer()));
	return name;
}

function isLanguage(value: string): boolean {
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	const smtp = getSmtp();
	const admin = locals.admin!;
	const pending = setupSecret(cookies, url, admin.id);
	const gdprEmail = (url.searchParams.get('email') ?? '').trim().toLowerCase();
	return {
		studio: getStudio(),
		preferences: getPreferences(),
		smtp: { ...smtp, pass: '', hasPass: Boolean(smtp.pass) },
		smtpFromEnv: config.smtpFromEnv,
		smtpConfigured: isSmtpConfigured(smtp),
		templates: listTemplates(),
		watermarks: listWatermarks().map((w) => ({
			id: w.id,
			name: w.name,
			kind: w.kind,
			text: w.text,
			position: w.position,
			scale: w.scale,
			opacity: w.opacity,
			version: w.version
		})),
		presets: listPresets().map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault })),
		languages: [...SUPPORTED_LANGUAGES],
		account: {
			email: admin.email,
			totp: Boolean(totpSecretOf(admin.id)),
			recoveryLeft: getDb().select({ codes: schema.users.recoveryCodes }).from(schema.users).where(eq(schema.users.id, admin.id)).get()?.codes.length ?? 0
		},
		totpSetup: pending
			? {
					secret: pending.replace(/(.{4})/g, '$1 ').trim(),
					qr: await QRCode.toString(otpauthUri(pending, admin.email, getStudio().name || 'Folio'), { type: 'svg', margin: 1, width: 200 })
				}
			: null,
		gdpr: EMAIL.test(gdprEmail) ? { email: gdprEmail, summary: summary(gdprEmail) } : null,
		adminIps: recentAdminIps(),
		currentIp: locals.ip
	};
};

export const actions: Actions = {
	branding: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (email && !EMAIL.test(email)) return fail(400, { tab: 'branding', error: 'admin.setup.errEmail' });
		const studio = getStudio();
		const update = {
			name: String(form.get('name') ?? '').trim(),
			email,
			phone: String(form.get('phone') ?? '').trim(),
			website: String(form.get('website') ?? '').trim(),
			logo: form.get('removeLogo') === 'on' ? null : studio.logo,
			coverLogo: form.get('removeCoverLogo') === 'on' ? null : studio.coverLogo,
			favicon: form.get('removeFavicon') === 'on' ? null : studio.favicon
		};
		if (!update.name) return fail(400, { tab: 'branding', error: 'admin.setup.errName' });

		const logo = form.get('logo');
		if (logo instanceof File && logo.size > 0) {
			const name = await storeBrandingFile(logo, 'logo');
			if (!name) return fail(400, { tab: 'branding', error: 'admin.studio.fileInvalid' });
			update.logo = name;
			// PNG version for emails (many email clients cannot show SVG or WebP).
			await sharp(path.join(brandingDir(), name), { density: 300 })
				.resize({ height: 200, width: 800, fit: 'inside', withoutEnlargement: true })
				.png()
				.toFile(path.join(brandingDir(), 'logo.png'));
		}
		const coverLogo = form.get('coverLogo');
		if (coverLogo instanceof File && coverLogo.size > 0) {
			const name = await storeBrandingFile(coverLogo, 'cover-logo');
			if (!name) return fail(400, { tab: 'branding', error: 'admin.studio.fileInvalid' });
			update.coverLogo = name;
		}
		const favicon = form.get('favicon');
		if (favicon instanceof File && favicon.size > 0) {
			const name = await storeBrandingFile(favicon, 'favicon');
			if (!name) return fail(400, { tab: 'branding', error: 'admin.studio.fileInvalid' });
			update.favicon = name;
		}
		saveStudio(update);
		return { tab: 'branding', saved: true };
	},

	preferences: async ({ request }) => {
		const form = await request.formData();
		const sharpen = String(form.get('sharpening') ?? '');
		const adminLanguage = String(form.get('adminLanguage') ?? '');
		const defaultLanguage = String(form.get('defaultLanguage') ?? '');
		if (isLanguage(adminLanguage)) saveStudio({ language: adminLanguage });
		savePreferences({
			sharpening: sharpen === 'standard' || sharpen === 'optimal' ? sharpen : 'none',
			defaultLanguage: isLanguage(defaultLanguage) ? defaultLanguage : getPreferences().defaultLanguage,
			banner: {
				enabled: form.get('bannerEnabled') === 'on',
				text: String(form.get('bannerText') ?? '').trim().slice(0, 200),
				code: String(form.get('bannerCode') ?? '').trim().slice(0, 50)
			}
		});
		return { tab: 'preferences', saved: true };
	},

	homepage: async ({ request }) => {
		const form = await request.formData();
		const links = String(form.get('links') ?? '')
			.split(/\s+/)
			.map((l) => l.trim())
			.filter((l) => /^https?:\/\/[^\s]+$/i.test(l))
			.slice(0, 8);
		savePreferences({
			homepage: {
				enabled: form.get('enabled') === 'on',
				title: String(form.get('title') ?? '').trim().slice(0, 120),
				intro: String(form.get('intro') ?? '').trim().slice(0, 2000),
				links
			}
		});
		return { tab: 'homepage', saved: true };
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
		const language = String(form.get('language') ?? '');
		saveTemplate({
			id: String(form.get('id') ?? '') || undefined,
			kind: (TEMPLATE_KINDS as string[]).includes(String(form.get('kind'))) ? (String(form.get('kind')) as TemplateKind) : 'delivery',
			language: isLanguage(language) ? language : getStudio().language,
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

	saveWatermark: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const existing = id ? getWatermark(id) : undefined;
		const name = String(form.get('name') ?? '').trim().slice(0, 100);
		if (!name) return fail(400, { tab: 'watermarks', error: 'admin.templates.errName' });
		const kind = form.get('kind') === 'text' ? 'text' : 'image';
		const position = String(form.get('position') ?? 'center') as WatermarkPosition;
		const scale = Math.min(1, Math.max(0.05, Number(form.get('scale')) || 0.3));
		const opacity = Math.min(1, Math.max(0.05, Number(form.get('opacity')) || 0.5));

		// The image: an uploaded file, or a PNG the browser rendered from the text.
		let file = existing?.file ?? null;
		const upload = form.get('image');
		const rendered = String(form.get('rendered') ?? '');
		let data: Buffer | null = null;
		if (upload instanceof File && upload.size > 0) {
			if (!IMAGE_TYPES[upload.type] || upload.size > 10 * 1024 * 1024) return fail(400, { tab: 'watermarks', error: 'admin.studio.fileInvalid' });
			data = Buffer.from(await upload.arrayBuffer());
		} else if (rendered.startsWith('data:image/png;base64,')) {
			data = Buffer.from(rendered.slice('data:image/png;base64,'.length), 'base64');
		}
		if (data) {
			const newFile = await saveWatermarkImage(data);
			if (file) await removeWatermarkFile(file);
			file = newFile;
		}
		if (!file) return fail(400, { tab: 'watermarks', error: 'admin.watermarks.errImage' });

		let text: TextWatermark | null = null;
		if (kind === 'text') {
			text = {
				text: String(form.get('text') ?? '').slice(0, 100),
				font: String(form.get('font') ?? 'modern'),
				color: /^#[0-9a-f]{6}$/i.test(String(form.get('color'))) ? String(form.get('color')) : '#ffffff'
			};
		}

		const values = {
			name,
			kind: kind as 'image' | 'text',
			file,
			text,
			position: WATERMARK_POSITIONS.includes(position) ? position : 'center',
			scale,
			opacity
		};
		const db = getDb();
		if (existing) {
			db.update(schema.watermarks).set({ ...values, version: existing.version + 1 }).where(eq(schema.watermarks.id, existing.id)).run();
		} else {
			db.insert(schema.watermarks).values({ id: crypto.randomUUID(), ...values }).run();
		}
		return { tab: 'watermarks', saved: true };
	},

	deleteWatermark: async ({ request }) => {
		const form = await request.formData();
		const wm = getWatermark(String(form.get('id') ?? ''));
		if (!wm) return fail(404);
		const db = getDb();
		db.update(schema.galleries).set({ watermarkId: null }).where(eq(schema.galleries.watermarkId, wm.id)).run();
		db.delete(schema.watermarks).where(eq(schema.watermarks.id, wm.id)).run();
		await removeWatermarkFile(wm.file);
		return { tab: 'watermarks', saved: true };
	},

	renamePreset: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (name) renamePreset(String(form.get('id')), name.slice(0, 100));
		return { tab: 'presets', saved: true };
	},

	defaultPreset: async ({ request }) => {
		const form = await request.formData();
		setDefaultPreset(String(form.get('id') ?? '') || null);
		return { tab: 'presets', saved: true };
	},

	deletePreset: async ({ request }) => {
		const form = await request.formData();
		deletePreset(String(form.get('id')));
		return { tab: 'presets', saved: true };
	},

	privacy: async ({ request }) => {
		const form = await request.formData();
		savePreferences({
			searchVisibility: form.get('searchVisibility') === 'homepage' ? 'homepage' : 'none',
			ignoreAdminIps: form.get('ignoreAdminIps') === 'on'
		});
		return { tab: 'privacy', saved: true };
	},

	forgetAdminIps: async ({ locals }) => {
		forgetAdminIps();
		// Keep the address in use right now, so this visit is still left out.
		noteAdminIp(locals.ip);
		return { tab: 'privacy', saved: true };
	},

	gdprDelete: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		if (!EMAIL.test(email)) return fail(400, { tab: 'privacy', error: 'admin.setup.errEmail' });
		deletePersonalData(email);
		return { tab: 'privacy', saved: true, deleted: email };
	},

	restore: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('backup');
		if (!(file instanceof File) || file.size === 0) return fail(400, { tab: 'backup', error: 'admin.backup.errFile' });
		const result = await restoreBackup(Buffer.from(await file.arrayBuffer()));
		if (!result.ok) return fail(400, { tab: 'backup', error: 'admin.backup.errFile' });
		redirect(303, '/admin/login');
	},

	totpStart: async ({ cookies, url, locals }) => {
		setupSecret(cookies, url, locals.admin!.id, generateSecret());
		return { tab: 'account' };
	},

	totpCancel: async ({ cookies, url }) => {
		clearSetupSecret(cookies, url);
		return { tab: 'account' };
	},

	totpEnable: async ({ request, cookies, url, locals }) => {
		const secret = setupSecret(cookies, url, locals.admin!.id);
		const code = String((await request.formData()).get('code') ?? '');
		if (!secret || !verifyTotp(secret, code)) return fail(400, { tab: 'account', error: 'admin.totp.wrong' });
		const { codes, hashes } = recoveryCodes();
		setTotp(locals.admin!.id, secret, hashes);
		clearSetupSecret(cookies, url);
		return { tab: 'account', saved: true, recoveryCodes: codes };
	},

	totpDisable: async ({ request, locals }) => {
		const password = String((await request.formData()).get('password') ?? '');
		if (!(await checkPassword(locals.admin!.id, password))) return fail(400, { tab: 'account', error: 'admin.account.wrongPassword' });
		setTotp(locals.admin!.id, null, []);
		return { tab: 'account', saved: true };
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
