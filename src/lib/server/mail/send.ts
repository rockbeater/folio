import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { and, asc, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import { clientPasswordOf } from '../access';
import { config } from '../config';
import { getDb, schema } from '../db';
import type { Gallery, GalleryEmailPayload, Order, TemplateKind } from '../db/schema';
import { getGalleryById, getSections } from '../galleries';
import { originalFile } from '../images/paths';
import { ensureEmailCover, sharpenKey } from '../images/render';
import { getSmtp, getStore, getStudio, isSmtpConfigured, type SmtpSettings } from '../settings';
import { formatMoney } from '$lib/store';
import { createI18n } from '$lib/i18n';
import { mergeFields, renderGalleryEmail, type MergeValues } from './render';
import { builtInTemplate, pickTemplate } from './templates';
import { logger } from '../log';

const log = logger('mail');

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
		client_password: clientPasswordOf(gallery) ?? '',
		studio_name: getStudio().name,
		event_date: gallery.eventDate ? formatDate(gallery.eventDate) : '',
		expiry_date: gallery.expiresOn ? formatDate(gallery.expiresOn) : ''
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
		if (preview) coverSrc = `/img/${cover.id}/${cover.version}${sharpenKey()}/w960.webp`; // admin preview: no watermark
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
		clientPassword: payload.includeClientPassword ? clientPasswordOf(gallery) : null,
		studio,
		coverSrc,
		logoSrc
	});
	return { subject: mergeFields(payload.subject, values), html, text, attachments };
}

/** Queue a gallery email to each recipient, now or at `scheduledFor` (ms). */
export function queueGalleryEmail(
	gallery: Gallery,
	recipients: string[],
	payload: GalleryEmailPayload,
	templateId: string | null,
	options: { kind?: 'gallery' | 'reminder'; scheduledFor?: number | null } = {}
): void {
	const db = getDb();
	const subject = mergeFields(payload.subject, mergeValuesFor(gallery, payload.baseUrl));
	const scheduledFor = options.scheduledFor && options.scheduledFor > Date.now() ? options.scheduledFor : null;
	for (const recipient of recipients) {
		db.insert(schema.emailLog)
			.values({
				id: crypto.randomUUID(),
				kind: options.kind ?? 'gallery',
				galleryId: gallery.id,
				templateId,
				recipient,
				subject,
				payload,
				scheduledFor,
				...(scheduledFor ? { nextAttemptAt: scheduledFor } : {})
			})
			.run();
	}
	void processQueue();
}

/** Queue a store email to the buyer (order confirmation, digital delivery, shipped, refunded). */
export function queueStoreEmail(order: Order, kind: Extract<TemplateKind, 'order' | 'digital' | 'shipped' | 'refunded'>, refundAmount = 0): void {
	const store = getStore();
	const baseUrl = config.baseUrl || store.siteUrl;
	const { t } = createI18n(order.language);
	const template = pickTemplate(kind, order.language) ?? builtInTemplate(kind, order.language);
	const link = `${baseUrl}/order/${order.token}`;
	const values: Record<string, string> = {
		client_name: order.name,
		order_number: String(order.number),
		order_total: formatMoney(order.total, order.currency, order.language),
		order_link: link,
		tracking_number: order.tracking ?? '',
		refund_amount: formatMoney(refundAmount, order.currency, order.language),
		studio_name: store.name || getStudio().name,
		gallery_name: order.galleryName
	};
	const subject = mergeFields(template.subject, values);
	getDb()
		.insert(schema.emailLog)
		.values({
			id: crypto.randomUUID(),
			kind: 'store',
			galleryId: order.galleryId,
			templateId: null,
			recipient: order.email,
			subject,
			payload: {
				subject,
				body: mergeFields(template.body, values),
				includePassword: false,
				baseUrl,
				title: t('store.orderNumber', { number: String(order.number) }),
				link,
				buttonLabel: t(kind === 'digital' ? 'email.downloadButton' : 'email.orderButton'),
				language: order.language
			}
		})
		.run();
	void processQueue();
}

/** A store email: the same layout as gallery emails, with the logo but without a cover photo. */
function composeStoreEmail(payload: GalleryEmailPayload): ComposedEmail {
	const studio = getStudio();
	const store = getStore();
	const attachments: Attachment[] = [];
	const logo = logoPngPath();
	if (logo) attachments.push({ filename: 'logo.png', path: logo, cid: 'logo@folio' });
	const { html, text } = renderGalleryEmail({
		language: payload.language ?? 'en',
		galleryName: payload.title ?? payload.subject,
		eventDate: '',
		message: payload.body,
		link: payload.link ?? payload.baseUrl,
		buttonLabel: payload.buttonLabel,
		password: null,
		studio: { ...studio, name: store.name || studio.name, email: store.email || studio.email },
		coverSrc: null,
		logoSrc: logo ? 'cid:logo@folio' : null
	});
	return { subject: payload.subject, html, text, attachments };
}

/** Queue a short plain-text notification to the photographer (studio email or admin). */
export function queueNotice(galleryId: string | null, to: string, subject: string, body: string): void {
	if (!to) return;
	getDb()
		.insert(schema.emailLog)
		.values({
			id: crypto.randomUUID(),
			kind: 'notice',
			galleryId,
			templateId: null,
			recipient: to,
			subject,
			payload: { subject, body, includePassword: false, baseUrl: '' }
		})
		.run();
	void processQueue();
}

/** Cancel a scheduled email that has not been sent yet. */
export function cancelScheduledEmail(logId: string): boolean {
	const db = getDb();
	const entry = db.select().from(schema.emailLog).where(eq(schema.emailLog.id, logId)).get();
	if (!entry || entry.status !== 'queued' || !entry.scheduledFor) return false;
	db.delete(schema.emailLog).where(eq(schema.emailLog.id, logId)).run();
	return true;
}

/**
 * Send expiry reminders: once per gallery, `reminderDays` before it expires,
 * to the client or to everyone who used the gallery.
 */
export function sendDueReminders(): void {
	const db = getDb();
	const date = new Date().toLocaleDateString('sv-SE');
	const candidates = db
		.select()
		.from(schema.galleries)
		.where(and(eq(schema.galleries.status, 'published'), isNull(schema.galleries.reminderSentAt)))
		.all()
		.filter((g) => g.expiresOn && g.reminderDays !== null && g.expiresOn >= date);
	for (const gallery of candidates) {
		const due = new Date(`${gallery.expiresOn}T12:00:00`);
		due.setDate(due.getDate() - (gallery.reminderDays ?? 0));
		if (due.toLocaleDateString('sv-SE') > date) continue;

		const recipients = new Set<string>();
		if (gallery.clientEmail) recipients.add(gallery.clientEmail.toLowerCase());
		if (gallery.reminderTo === 'all') {
			for (const v of db.select({ email: schema.visitors.email }).from(schema.visitors).where(eq(schema.visitors.galleryId, gallery.id)).all()) {
				recipients.add(v.email.toLowerCase());
			}
		}
		const baseUrl = config.baseUrl || lastBaseUrl(gallery.id);
		if (recipients.size === 0 || !baseUrl) {
			if (!baseUrl) console.warn(`[folio] no BASE_URL known for reminder of "${gallery.name}"; set BASE_URL`);
			db.update(schema.galleries).set({ reminderSentAt: Date.now() }).where(eq(schema.galleries.id, gallery.id)).run();
			continue;
		}
		const template = pickTemplate('reminder', gallery.language) ?? { id: null, ...builtInTemplate('reminder', gallery.language) };
		queueGalleryEmail(
			gallery,
			[...recipients],
			{ subject: template.subject, body: template.body, includePassword: Boolean(gallery.password), baseUrl },
			template.id,
			{ kind: 'reminder' }
		);
		db.update(schema.galleries).set({ reminderSentAt: Date.now() }).where(eq(schema.galleries.id, gallery.id)).run();
	}
}

/**
 * The gallery has been published after a pre-release: email everyone who signed up for it.
 * Returns how many were emailed. The gallery password is never included (anyone could sign up).
 */
export function queueReleaseEmails(gallery: Gallery, baseUrl: string): number {
	const db = getDb();
	const waiting = db
		.select({ id: schema.visitors.id, email: schema.visitors.email })
		.from(schema.visitors)
		.where(and(eq(schema.visitors.galleryId, gallery.id), eq(schema.visitors.notifyOnRelease, true)))
		.all();
	if (waiting.length === 0) return 0;
	const template = pickTemplate('release', gallery.language) ?? { id: null, ...builtInTemplate('release', gallery.language) };
	queueGalleryEmail(gallery, waiting.map((w) => w.email), { subject: template.subject, body: template.body, includePassword: false, baseUrl }, template.id);
	db.update(schema.visitors)
		.set({ notifyOnRelease: false })
		.where(inArray(schema.visitors.id, waiting.map((w) => w.id)))
		.run();
	log.info(`"${gallery.name}" released: ${waiting.length} sign-ups emailed`);
	return waiting.length;
}

/** The address used the last time this gallery was emailed (fallback when BASE_URL is not set). */
function lastBaseUrl(galleryId: string): string | null {
	const entry = getDb()
		.select({ payload: schema.emailLog.payload })
		.from(schema.emailLog)
		.where(eq(schema.emailLog.galleryId, galleryId))
		.orderBy(desc(schema.emailLog.createdAt))
		.get();
	return entry?.payload?.baseUrl ?? null;
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
			if (entry.kind === 'notice' && entry.payload) {
				// Plain notification to the photographer.
				try {
					await mailer.sendMail({ ...sender(smtp), to: entry.recipient, subject: entry.payload.subject, text: entry.payload.body });
					db.update(schema.emailLog).set({ status: 'sent', sentAt: Date.now(), error: null, attempts: entry.attempts + 1 }).where(eq(schema.emailLog.id, entry.id)).run();
				} catch (err) {
					log.warn(`email to ${entry.recipient} failed`, (err as Error).message);
					db.update(schema.emailLog)
						.set({ status: 'failed', attempts: entry.attempts + 1, error: (err as Error).message?.slice(0, 500) ?? String(err) })
						.where(eq(schema.emailLog.id, entry.id))
						.run();
				}
				continue;
			}
			if (entry.kind === 'store' && entry.payload) {
				try {
					await mailer.sendMail({ ...sender(smtp), to: entry.recipient, ...composeStoreEmail(entry.payload) });
					db.update(schema.emailLog).set({ status: 'sent', sentAt: Date.now(), error: null, attempts: entry.attempts + 1 }).where(eq(schema.emailLog.id, entry.id)).run();
				} catch (err) {
					log.warn(`email to ${entry.recipient} failed`, (err as Error).message);
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
				continue;
			}
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
				log.warn(`email to ${entry.recipient} failed`, (err as Error).message);
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

/** Connect and log in to the mail server without sending anything (the self-check). */
export async function verifySmtp(smtp = getSmtp()): Promise<void> {
	const mailer = transport(smtp);
	try {
		await mailer.verify();
	} finally {
		mailer.close();
	}
}

export function startMailQueue(): void {
	setInterval(() => void processQueue(), 30_000).unref();
	void processQueue();
	const reminders = () => {
		try {
			sendDueReminders();
		} catch (err) {
			console.warn('[folio] reminder check failed:', (err as Error).message);
		}
	};
	setInterval(reminders, 60 * 60 * 1000).unref();
	setTimeout(reminders, 10_000).unref();
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
