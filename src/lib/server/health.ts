import fs from 'node:fs';
import { and, eq, gt, sql } from 'drizzle-orm';
import { config } from './config';
import { getDb, schema } from './db';
import { libraryState } from './library/scanner';
import { logger } from './log';
import { queueNotice, verifySmtp } from './mail/send';
import { getSmtp, getStore, getStudio, isSmtpConfigured, readSetting, writeSetting } from './settings';
import { verifyKey, webhookStatus } from './store/stripe';
import { createI18n, type MessageKey } from '$lib/i18n';

/**
 * The self-check: Folio looks at what it depends on every 15 minutes and tells the owner when
 * something is wrong (a banner in the admin, Settings → System, and an email when a check fails).
 */

export const CHECK_IDS = ['stripe', 'webhook', 'email', 'mailQueue', 'library', 'storage', 'address', 'photos'] as const;
export type CheckId = (typeof CHECK_IDS)[number];
/** off: not in use (e.g. the store is closed). */
export type CheckStatus = 'ok' | 'warn' | 'error' | 'off';

export interface CheckResult {
	id: CheckId;
	status: CheckStatus;
	message: MessageKey;
	params?: Record<string, string | number>;
	checkedAt: number;
}

const log = logger('health');
const INTERVAL = 15 * 60 * 1000;
const TIMEOUT = 20_000;
/** At most one email per failing check per day. */
const ALERT_EVERY = 24 * 60 * 60 * 1000;
const GB = 1024 ** 3;

const results = new Map<CheckId, CheckResult>();
let running: Promise<CheckResult[]> | null = null;

function result(id: CheckId, status: CheckStatus, message: string, params?: CheckResult['params']): CheckResult {
	return { id, status, message: message as MessageKey, params, checkedAt: Date.now() };
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
	return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), TIMEOUT).unref())]);
}

/** Error text without stack, short enough for a banner. */
function reason(err: unknown): string {
	const e = err as Error & { cause?: { code?: string; message?: string } };
	const text = e.cause?.code ?? e.cause?.message ?? e.message ?? String(err);
	return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

async function checkStripe(): Promise<CheckResult> {
	const store = getStore();
	if (!store.enabled) return result('stripe', 'off', 'health.stripe.off');
	if (!store.stripe.secretKey) {
		return config.stripeSimulator ? result('stripe', 'off', 'health.stripe.simulator') : result('stripe', 'error', 'health.stripe.noKey');
	}
	try {
		const { mode, accountName } = await withTimeout(verifyKey(store.stripe.secretKey));
		return result('stripe', 'ok', 'health.stripe.ok', { mode, account: accountName || '–' });
	} catch (err) {
		const status = (err as { status?: number }).status;
		if (status === 401) return result('stripe', 'error', 'health.stripe.invalidKey');
		return result('stripe', 'error', 'health.stripe.unreachable', { reason: reason(err) });
	}
}

async function checkWebhook(stripe: CheckResult): Promise<CheckResult> {
	const store = getStore();
	if (!store.enabled || !store.stripe.secretKey) return result('webhook', 'off', 'health.webhook.off');
	// One problem, one message: the webhook is checked once Stripe itself answers.
	if (stripe.status !== 'ok') return result('webhook', 'off', 'health.webhook.waiting');
	if (config.baseUrl && store.stripe.webhookUrl && !store.stripe.webhookUrl.startsWith(config.baseUrl)) {
		return result('webhook', 'error', 'health.webhook.wrongUrl', { url: store.stripe.webhookUrl });
	}
	try {
		const status = await withTimeout(webhookStatus());
		if (status === 'missing') return result('webhook', 'error', 'health.webhook.missing');
		if (status === 'disabled') return result('webhook', 'error', 'health.webhook.disabled');
		return result('webhook', 'ok', 'health.webhook.ok', { url: store.stripe.webhookUrl || '–' });
	} catch (err) {
		return result('webhook', 'error', 'health.stripe.unreachable', { reason: reason(err) });
	}
}

async function checkEmail(): Promise<CheckResult> {
	const smtp = getSmtp();
	if (!isSmtpConfigured(smtp)) return result('email', 'warn', 'health.email.notSetUp');
	try {
		await withTimeout(verifySmtp(smtp));
		return result('email', 'ok', 'health.email.ok', { host: smtp.host });
	} catch (err) {
		return result('email', 'error', 'health.email.failed', { host: smtp.host, reason: reason(err) });
	}
}

function checkMailQueue(): CheckResult {
	const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
	const failed = getDb()
		.select({ n: sql<number>`count(*)` })
		.from(schema.emailLog)
		.where(and(eq(schema.emailLog.status, 'failed'), gt(schema.emailLog.createdAt, since)))
		.get()!.n;
	return failed > 0 ? result('mailQueue', 'warn', 'health.mailQueue.failed', { count: failed }) : result('mailQueue', 'ok', 'health.mailQueue.ok');
}

function checkLibrary(): CheckResult {
	if (!libraryState.available) return result('library', 'error', 'health.library.missing', { path: config.photosDir });
	try {
		fs.accessSync(config.photosDir, fs.constants.W_OK);
	} catch {
		return result('library', 'warn', 'health.library.readOnly', { path: config.photosDir });
	}
	return result('library', 'ok', 'health.library.ok', { path: config.photosDir });
}

function checkStorage(): CheckResult {
	let worst: { path: string; free: number; share: number } | null = null;
	for (const path of [config.dataDir, config.cacheDir, config.photosDir]) {
		try {
			const stats = fs.statfsSync(path);
			const free = stats.bavail * stats.bsize;
			const share = free / Math.max(1, stats.blocks * stats.bsize);
			if (!worst || free < worst.free) worst = { path, free, share };
		} catch {
			// A folder that cannot be read is reported by the library check.
		}
	}
	if (!worst) return result('storage', 'off', 'health.storage.unknown');
	// A number, so it is shown with the admin language's decimal mark.
	const params = { path: worst.path, free: Math.round((worst.free / GB) * 10) / 10 };
	if (worst.free < 1 * GB) return result('storage', 'error', 'health.storage.full', params);
	if (worst.free < 5 * GB || worst.share < 0.05) return result('storage', 'warn', 'health.storage.low', params);
	return result('storage', 'ok', 'health.storage.ok', params);
}

function checkAddress(): CheckResult {
	return config.baseUrl ? result('address', 'ok', 'health.address.ok', { url: config.baseUrl }) : result('address', 'warn', 'health.address.missing');
}

function checkPhotos(): CheckResult {
	const failed = getDb().select({ n: sql<number>`count(*)` }).from(schema.photos).where(eq(schema.photos.status, 'error')).get()!.n;
	return failed > 0 ? result('photos', 'warn', 'health.photos.failed', { count: failed }) : result('photos', 'ok', 'health.photos.ok');
}

/** Numbers in a message, written the way the language writes them (27,5 in Danish). */
export function localParams(params: CheckResult['params'], lang: string): Record<string, string> {
	const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
	return Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, typeof v === 'number' ? number.format(v) : v]));
}

/** Email the owner when a check starts failing (not about email itself, which cannot be sent then). */
function alert(previous: CheckResult | undefined, next: CheckResult): void {
	if (next.status !== 'error' || previous?.status === 'error' || next.id === 'email') return;
	const smtp = getSmtp();
	const studio = getStudio();
	if (!isSmtpConfigured(smtp) || !studio.email) return;
	const sent = readSetting<Record<string, number>>('healthAlerts', {});
	if (Date.now() - (sent[next.id] ?? 0) < ALERT_EVERY) return;
	const { t } = createI18n(studio.language);
	const problem = t(next.message, localParams(next.params, studio.language));
	queueNotice(null, studio.email, t('health.alert.subject', { problem: t(`health.name.${next.id}` as MessageKey) }), t('health.alert.body', { problem }));
	writeSetting('healthAlerts', { ...sent, [next.id]: Date.now() });
}

/** Run every check now. Concurrent calls share one run. */
export function runChecks(): Promise<CheckResult[]> {
	running ??= (async () => {
		const stripe = checkStripe();
		const settled = await Promise.allSettled([
			stripe,
			stripe.then(checkWebhook, (err) => checkWebhook(result('stripe', 'error', 'health.failed', { reason: reason(err) }))),
			checkEmail(),
			Promise.resolve().then(checkMailQueue),
			Promise.resolve().then(checkLibrary),
			Promise.resolve().then(checkStorage),
			Promise.resolve().then(checkAddress),
			Promise.resolve().then(checkPhotos)
		]);
		settled.forEach((outcome, i) => {
			const id = CHECK_IDS[i];
			const next = outcome.status === 'fulfilled' ? outcome.value : result(id, 'error', 'health.failed', { reason: reason(outcome.reason) });
			const previous = results.get(id);
			if (previous?.status !== next.status) {
				const line = `${id}: ${previous?.status ?? 'new'} → ${next.status}`;
				if (next.status === 'error') log.error(line, next.params ?? '');
				else if (next.status === 'warn') log.warn(line, next.params ?? '');
				else if (previous) log.info(line);
			}
			try {
				alert(previous, next);
			} catch (err) {
				log.warn('could not queue the alert email', (err as Error).message);
			}
			results.set(id, next);
		});
		return CHECK_IDS.map((id) => results.get(id)!);
	})().finally(() => {
		running = null;
	});
	return running;
}

/** The latest results, in a fixed order (empty until the first run has finished). */
export function healthResults(): CheckResult[] {
	return CHECK_IDS.map((id) => results.get(id)).filter((r): r is CheckResult => Boolean(r));
}

/** What needs attention, errors first. */
export function healthProblems(): CheckResult[] {
	return healthResults()
		.filter((r) => r.status === 'error' || r.status === 'warn')
		.sort((a, b) => (a.status === b.status ? 0 : a.status === 'error' ? -1 : 1));
}

export function startHealthChecks(): void {
	const run = () => void runChecks().catch((err) => log.warn('self-check failed', (err as Error).message));
	setTimeout(run, 15_000).unref();
	setInterval(run, INTERVAL).unref();
}
