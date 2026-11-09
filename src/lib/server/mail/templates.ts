import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { EmailTemplate } from '../db/schema';
import { createI18n } from '$lib/i18n';

export function listTemplates(): EmailTemplate[] {
	return getDb()
		.select()
		.from(schema.emailTemplates)
		.orderBy(asc(schema.emailTemplates.createdAt), asc(schema.emailTemplates.name))
		.all();
}

export function getTemplate(id: string): EmailTemplate | undefined {
	return getDb().select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, id)).get();
}

/** Make sure there is always at least one template, and exactly one default. */
export function ensureDefaultTemplate(language = 'en'): void {
	const templates = listTemplates();
	if (templates.length === 0) {
		const { t } = createI18n(language);
		getDb()
			.insert(schema.emailTemplates)
			.values({
				id: crypto.randomUUID(),
				name: t('email.defaultTemplate.name'),
				subject: t('email.defaultTemplate.subject'),
				body: t('email.defaultTemplate.body'),
				isDefault: true
			})
			.run();
		return;
	}
	if (!templates.some((tpl) => tpl.isDefault)) setDefaultTemplate(templates[0].id);
}

export function saveTemplate(input: { id?: string; name: string; subject: string; body: string }): string {
	const db = getDb();
	if (input.id && getTemplate(input.id)) {
		db.update(schema.emailTemplates)
			.set({ name: input.name, subject: input.subject, body: input.body, updatedAt: Date.now() })
			.where(eq(schema.emailTemplates.id, input.id))
			.run();
		return input.id;
	}
	const id = crypto.randomUUID();
	db.insert(schema.emailTemplates)
		.values({ id, name: input.name, subject: input.subject, body: input.body, isDefault: listTemplates().length === 0 })
		.run();
	return id;
}

export function setDefaultTemplate(id: string): void {
	const db = getDb();
	db.transaction((tx) => {
		tx.update(schema.emailTemplates).set({ isDefault: false }).run();
		tx.update(schema.emailTemplates).set({ isDefault: true }).where(eq(schema.emailTemplates.id, id)).run();
	});
}

export function deleteTemplate(id: string): void {
	getDb().delete(schema.emailTemplates).where(eq(schema.emailTemplates.id, id)).run();
	ensureDefaultTemplate();
}
