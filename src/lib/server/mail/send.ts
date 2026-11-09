import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { and, asc, eq, lte } from 'drizzle-orm';
import { config } from '../config';
import { getDb, schema } from '../db';
import type { Gallery, GalleryEmailPayload } from '../db/schema';
import { getGalleryById, getSections } from '../galleries';
import { originalFile } from '../images/paths';
import { ensureEmailCover } from '../images/render';
import { getSmtp, getStudio, isSmtpConfigured, type SmtpSettings } from '../settings';
import { createI18n } from '$lib/i18n';
import { mergeFields, renderGalleryEmail, type MergeValues } from './render';

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000];

function transport(smtp: SmtpSettings) {
	return nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.security === 'tls',
		requireTLS: smtp.security === 'starttls',
		ignoreTLS: smtp.security === 'none',
		auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
		connectionTimeout: 20_000,
		greetingTimeout: 20_000,
		socketTimeout: 60_000
	});
}

function sender(smtp: SmtpSettings): { from: { name: string; address: string }; replyTo?: string } {
	const studio = getStudio();
	return {
		from: { name: smtp.fromName || studio.name || 'Folio', address: smtp.fromEmail },
		replyTo: studio.email && studio.email !== smtp.fromEmail ? studio.email : undefined
	};
}

export function logoPngPath(): string | null {
	const file = path.join(config.dataDir, 'branding', 'logo.png');
	return getStudio().logo && fs.existsSync(file) ? file : null;
}

export function galleryLink(baseUrl: string, gallery: Pick<Gallery, 'slug'>): string {
	return `${baseUrl}/g/${gallery.slug}`;
}

export function mergeValuesFor(gallery: Gallery, baseUrl: string): MergeValues {
	const { formatDate } = createI18n(gallery.language);
	return {
		client_name: gallery.clientName ?? '',
		gallery_name: gallery.name,
		gallery_link: galleryLink(baseUrl, gallery),
		password: gallery.password ?? '',
		studio_name: getStudio().name,
		event_date: gallery.eventDate ? formatDate(gallery.eventDate) : ''
	};
}

/** The cover photo, or the first ready photo, used as the email image. */
export function emailCoverPhoto(gallery: Gallery) {
	const db = getDb();
	const byId = gallery.coverPhotoId
		? db.select().from(schema.photos).where(eq(schema.photos.id, gallery.coverPhotoId)).get()
		: undefined;
	if (byId) return byId;
	for (const section of getSections(gallery.id)) {
		const first = db
			.select()
			.from(schema.photos)
			.where(and(eq(schema.photos.sectionId, section.id), eq(schema.photos.status, 'ready')))
			.orderBy(asc(schema.photos.filename))
			.get();
		if (first) return first;
	}
	return undefined;
}

export interface ComposedEmail {
	subject: string;
	html: string;
	text: string;
	attachments: Attachment[];
}

/** Build the gallery email. `preview` uses normal URLs instead of embedded images. */
export async function composeGalleryEmail(gallery: Gallery, payload: GalleryEmailPayload, preview = false): Promise<ComposedEmail> {
	const studio = getStudio();
	const values = mergeValuesFor(gallery, payload.baseUrl);
	const attachments: Attachment[] = [];

	let coverSrc: string | null = null;
	const cover = emailCoverPhoto(gallery);
	if (cover) {
		if (preview) coverSrc = `/img/${cover.id}/${cover.version}/w960.webp`;
		else {
			const section = getSections(gallery.id).find((s) => s.id === cover.sectionId);
			if (section) {
				try {
					const file = await ensureEmailCover(originalFile(gallery.folder, section.folder, cover.filename), cover.id, cover.version);
					attachments.push({ filename: 'cover.jpg', path: file, cid: 'cover@folio' });
					coverSrc = 'cid:cover@folio';
				} catch (err) {
					console.warn('[folio] could not prepare email cover:', (err as Error).message);
				}
			}
		}
	}

	let logoSrc: string | null = null;
	const logo = logoPngPath();
	if (logo) {
		if (preview) logoSrc = '/branding/logo.png';
		else {
			attachments.push({ filename: 'logo.png', path: logo, cid: 'logo@folio' });
			logoSrc = 'cid:logo@folio';
		}
	}

	const { html, text } = renderGalleryEmail({
		language: gallery.language,
		galleryName: gallery.name,
		eventDate: values.event_date,
		message: mergeFields(payload.body, values),
		link: values.gallery_link,
		password: payload.includePassword && gallery.password ? gallery.password : null,
		studio,
		coverSrc,
		logoSrc
	});
	return { subject: mergeFields(payload.subject, values), html, text, attachments };
}

/** Queue a gallery email to each recipient. */
export function queueGalleryEmail(
	gallery: Gallery,
	recipients: string[],
	payload: GalleryEmailPayload,
	templateId: string | null
): void {
	const db = getDb();
	const subject = mergeFields(payload.subject, mergeValuesFor(gallery, payload.baseUrl));
	for (const recipient of recipients) {
		db.insert(schema.emailLog)
			.values({ id: crypto.randomUUID(), kind: 'gallery', galleryId: gallery.id, templateId, recipient, subject, payload })
			.run();
	}
	void processQueue();
}

/** Re-send a previous email (same content, current gallery data). */
export function resendEmail(logId: string): boolean {
	const db = getDb();
	const entry = db.select().from(schema.emailLog).where(eq(schema.emailLog.id, logId)).get();
	if (!entry || !entry.payload || !entry.galleryId) return false;
	db.insert(schema.emailLog)
		.values({
			id: crypto.randomUUID(),
			kind: entry.kind,
			galleryId: entry.galleryId,
			templateId: entry.templateId,
			recipient: entry.recipient,
			subject: entry.subject,
			payload: entry.payload
		})
		.run();
	void processQueue();
	return true;
}

function isTransient(err: unknown): boolean {
	const e = err as { responseCode?: number; code?: string };
	if (typeof e?.responseCode === 'number') return e.responseCode >= 400 && e.responseCode < 500;
	return ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ESOCKET', 'EDNS', 'ECONNREFUSED'].includes(e?.code ?? '');
}

let processing = false;

export async function processQueue(): Promise<void> {
	if (processing) return;
	processing = true;
	try {
		const smtp = getSmtp();
		if (!isSmtpConfigured(smtp)) return;
		const db = getDb();
		const due = db
			.select()
			.from(schema.emailLog)
			.where(and(eq(schema.emailLog.status, 'queued'), lte(schema.emailLog.nextAttemptAt, Date.now())))
			.orderBy(asc(schema.emailLog.createdAt))
			.all();
		if (due.length === 0) return;
		const mailer = transport(smtp);
		for (const entry of due) {
			const gallery = entry.galleryId ? getGalleryById(entry.galleryId) : undefined;
			if (!gallery || !entry.payload) {
				db.update(schema.emailLog).set({ status: 'failed', error: 'Gallery not found' }).where(eq(schema.emailLog.id, entry.id)).run();
				continue;
			}
			try {
				const email = await composeGalleryEmail(gallery, entry.payload);
				await mailer.sendMail({ ...sender(smtp), to: entry.recipient, ...email });
				db.update(schema.emailLog)
					.set({ status: 'sent', sentAt: Date.now(), error: null, attempts: entry.attempts + 1 })
					.where(eq(schema.emailLog.id, entry.id))
					.run();
			} catch (err) {
				const attempts = entry.attempts + 1;
				const retry = isTransient(err) && attempts <= RETRY_DELAYS_MS.length;
				db.update(schema.emailLog)
					.set({
						attempts,
						status: retry ? 'queued' : 'failed',
						error: (err as Error).message?.slice(0, 500) ?? String(err),
						nextAttemptAt: Date.now() + (RETRY_DELAYS_MS[attempts - 1] ?? 0)
					})
					.where(eq(schema.emailLog.id, entry.id))
					.run();
			}
		}
		mailer.close();
	} finally {
		processing = false;
	}
}

export function startMailQueue(): void {
	setInterval(() => void processQueue(), 30_000).unref();
	void processQueue();
}

/** Send a test email right away and report the error if it fails. */
export async function sendTestEmail(to: string, smtp = getSmtp()): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!isSmtpConfigured(smtp)) return { ok: false, error: 'Missing SMTP server or sender address' };
	const { t } = createI18n(getStudio().language);
	const mailer = transport(smtp);
	try {
		await mailer.sendMail({ ...sender(smtp), to, subject: t('email.testSubject'), text: t('email.testBody') });
		return { ok: true };
	} catch (err) {
		return { ok: false, error: (err as Error).message ?? String(err) };
	} finally {
		mailer.close();
	}
}

/** Send a gallery email immediately to the photographer (test before sending to the client). */
export async function sendGalleryTest(gallery: Gallery, to: string, payload: GalleryEmailPayload) {
	const smtp = getSmtp();
	if (!isSmtpConfigured(smtp)) return { ok: false as const, error: 'Email is not set up' };
	const mailer = transport(smtp);
	try {
		const email = await composeGalleryEmail(gallery, payload);
		await mailer.sendMail({ ...sender(smtp), to, ...email, subject: `[Test] ${email.subject}` });
		return { ok: true as const };
	} catch (err) {
		return { ok: false as const, error: (err as Error).message ?? String(err) };
	} finally {
		mailer.close();
	}
}
