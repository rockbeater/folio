import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-health-'));
process.env.PHOTOS_DIR = path.join(tmp, 'photos');
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.CACHE_DIR = path.join(tmp, 'cache');
for (const dir of ['photos', 'data', 'cache']) fs.mkdirSync(path.join(tmp, dir), { recursive: true });

let health: typeof import('./health');
let settings: typeof import('./settings');
let dbm: typeof import('./db');

beforeAll(async () => {
	dbm = await import('./db');
	settings = await import('./settings');
	health = await import('./health');
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const byId = (results: { id: string; status: string; message: string }[], id: string) => results.find((r) => r.id === id)!;

describe('self-check', () => {
	it('reports what is not set up, and nothing for a closed store', async () => {
		const results = await health.runChecks();
		expect(results).toHaveLength(health.CHECK_IDS.length);
		expect(byId(results, 'stripe').status).toBe('off');
		expect(byId(results, 'webhook').status).toBe('off');
		expect(byId(results, 'email')).toMatchObject({ status: 'warn', message: 'health.email.notSetUp' });
		expect(byId(results, 'library').status).toBe('ok');
		expect(byId(results, 'photos').status).toBe('ok');
	});

	it('notices a lost connection and an invalid key, and emails the owner once', async () => {
		settings.saveStudio({ email: 'owner@example.com' });
		settings.saveSmtp({ host: '127.0.0.1', port: 1, fromEmail: 'folio@example.com', security: 'none' });
		settings.saveStore({ enabled: true, stripe: { secretKey: 'sk_test_123', webhookId: 'we_1', webhookSecret: 'whsec_1', webhookUrl: '' } });

		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
		let results = await health.runChecks();
		expect(byId(results, 'stripe')).toMatchObject({ status: 'error', message: 'health.stripe.unreachable' });
		expect(health.healthProblems()[0].status).toBe('error');

		const { schema } = dbm;
		const alerts = () => dbm.getDb().select().from(schema.emailLog).all().filter((e) => e.kind === 'notice');
		const first = alerts().length;
		expect(first).toBeGreaterThan(0);

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Invalid API Key provided' } }), { status: 401 })));
		results = await health.runChecks();
		expect(byId(results, 'stripe')).toMatchObject({ status: 'error', message: 'health.stripe.invalidKey' });
		// Still failing: no second email the same day.
		expect(alerts().length).toBe(first);
	});
});
