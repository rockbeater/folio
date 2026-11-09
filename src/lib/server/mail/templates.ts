import crypto from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { EmailTemplate, TemplateKind } from '../db/schema';
import { createI18n } from '$lib/i18n';

export const TEMPLATE_KINDS: TemplateKind[] = ['delivery', 'reminder'];

export function listTemplates(kind?: TemplateKind): EmailTemplate[] {
	return getDb()
		.select()
		.from(schema.emailTemplates)
		.where(kind ? eq(schema.emailTemplates.kind, kind) : undefined)
		.orderBy(asc(schema.emailTemplates.createdAt), asc(schema.emailTemplates.name))
		.all();
}

export function getTemplate(id: string): EmailTemplate | undefined {
	return getDb().select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, id)).get();
}

/** The built-in text for a template kind, in a language. */
export function builtInTemplate(kind: TemplateKind, language: string): { name: string; subject: string; body: string } {
	const { t } = createI18n(language);
	return kind === 'reminder'
		? { name: t('email.reminderTemplate.name'), subject: t('email.reminderTemplate.subject'), body: t('email.reminderTemplate.body') }
		: { name: t('email.defaultTemplate.name'), subject: t('email.defaultTemplate.subject'), body: t('email.defaultTemplate.body') };
}

/** Make sure every kind has at least one template, and each kind+language group has one default. */
export function ensureDefaultTemplates(language = 'en'): void {
	const db = getDb();
	for (const kind of TEMPLATE_KINDS) {
		const templates = listTemplates(kind);
		if (templates.length === 0) {
			db.insert(schema.emailTemplates)
				.values({ id: crypto.randomUUID(), kind, language, ...builtInTemplate(kind, language), isDefault: true })
				.run();
			continue;
		}
		for (const lang of new Set(templates.map((t) => t.language))) {
			const group = templates.filter((t) => t.language === lang);
			if (!group.some((t) => t.isDefault)) setDefaultTemplate(group[0].id);
		}
	}
}

/** The template to use for a gallery: the default in its language, else any default, else any. */
export function pickTemplate(kind: TemplateKind, language: string): EmailTemplate | undefined {
	const templates = listTemplates(kind);
	return (
		templates.find((t) => t.language === language && t.isDefault) ??
		templates.find((t) => t.language === language) ??
		templates.find((t) => t.isDefault) ??
		templates[0]
	);
}

export function saveTemplate(input: {
	id?: string;
	kind: TemplateKind;
	language: string;
	name: string;
	subject: string;
	body: string;
}): string {
	const db = getDb();
	const existing = input.id ? getTemplate(input.id) : undefined;
	if (existing) {
		db.update(schema.emailTemplates)
			.set({ kind: input.kind, language: input.language, name: input.name, subject: input.subject, body: input.body, updatedAt: Date.now() })
			.where(eq(schema.emailTemplates.id, existing.id))
			.run();
		ensureDefaultTemplates();
		return existing.id;
	}
	const id = crypto.randomUUID();
	const hasDefault = listTemplates(input.kind).some((t) => t.language === input.language && t.isDefault);
	db.insert(schema.emailTemplates)
		.values({ id, kind: input.kind, language: input.language, name: input.name, subject: input.subject, body: input.body, isDefault: !hasDefault })
		.run();
	return id;
}

/** Make a template the default for its kind and language. */
export function setDefaultTemplate(id: string): void {
	const template = getTemplate(id);
	if (!template) return;
	getDb().transaction((tx) => {
		tx.update(schema.emailTemplates)
			.set({ isDefault: false })
			.where(and(eq(schema.emailTemplates.kind, template.kind), eq(schema.emailTemplates.language, template.language)))
			.run();
		tx.update(schema.emailTemplates).set({ isDefault: true }).where(eq(schema.emailTemplates.id, id)).run();
	});
}

export function deleteTemplate(id: string): void {
	getDb().delete(schema.emailTemplates).where(eq(schema.emailTemplates.id, id)).run();
	ensureDefaultTemplates();
}
