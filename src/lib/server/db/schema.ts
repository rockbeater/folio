import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { DownloadSettings, GalleryDesign, GalleryStatus } from '$lib/types';

const now = sql`(unixepoch() * 1000)`;

/** Key/value store for studio-wide settings (branding, SMTP, …). Values are JSON. */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull()
});

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at').notNull().default(now)
});

export const sessions = sqliteTable('sessions', {
	/** sha256 of the session token; the token itself only lives in the cookie. */
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull(),
	createdAt: integer('created_at').notNull().default(now)
});

export interface ScanWarning {
	code: 'rootImages' | 'nestedFolders' | 'unsupportedFiles' | 'readOnly';
	section?: string;
	count?: number;
}

export const galleries = sqliteTable(
	'galleries',
	{
		/** Same id as written to the `.folio-id` file in the gallery folder. */
		id: text('id').primaryKey(),
		/** Folder name relative to the photo library root. */
		folder: text('folder').notNull(),
		name: text('name').notNull(),
		slug: text('slug').notNull().unique(),
		eventDate: text('event_date'),
		status: text('status').$type<GalleryStatus>().notNull().default('draft'),
		missing: integer('missing', { mode: 'boolean' }).notNull().default(false),
		coverPhotoId: text('cover_photo_id'),
		coverFocalX: real('cover_focal_x').notNull().default(0.5),
		coverFocalY: real('cover_focal_y').notNull().default(0.5),
		password: text('password'),
		design: text('design', { mode: 'json' }).$type<GalleryDesign>().notNull(),
		download: text('download', { mode: 'json' }).$type<DownloadSettings>().notNull(),
		favoritesEnabled: integer('favorites_enabled', { mode: 'boolean' }).notNull().default(true),
		language: text('language').notNull().default('en'),
		clientName: text('client_name'),
		clientEmail: text('client_email'),
		warnings: text('warnings', { mode: 'json' }).$type<ScanWarning[]>().notNull().default(sql`'[]'`),
		createdAt: integer('created_at').notNull().default(now),
		updatedAt: integer('updated_at').notNull().default(now),
		publishedAt: integer('published_at')
	},
	(t) => [index('galleries_folder_idx').on(t.folder)]
);

export type SortMode = 'filename' | 'date' | 'manual';

export const sections = sqliteTable(
	'sections',
	{
		id: text('id').primaryKey(),
		galleryId: text('gallery_id')
			.notNull()
			.references(() => galleries.id, { onDelete: 'cascade' }),
		folder: text('folder').notNull(),
		slug: text('slug').notNull(),
		position: integer('position').notNull().default(0),
		sortMode: text('sort_mode').$type<SortMode>().notNull().default('filename'),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [uniqueIndex('sections_gallery_folder_idx').on(t.galleryId, t.folder)]
);

export type PhotoStatus = 'pending' | 'ready' | 'error';

export const photos = sqliteTable(
	'photos',
	{
		id: text('id').primaryKey(),
		galleryId: text('gallery_id')
			.notNull()
			.references(() => galleries.id, { onDelete: 'cascade' }),
		sectionId: text('section_id')
			.notNull()
			.references(() => sections.id, { onDelete: 'cascade' }),
		filename: text('filename').notNull(),
		size: integer('size').notNull(),
		mtimeMs: integer('mtime_ms').notNull(),
		width: integer('width').notNull().default(0),
		height: integer('height').notNull().default(0),
		takenAt: integer('taken_at'),
		position: integer('position').notNull().default(0),
		status: text('status').$type<PhotoStatus>().notNull().default('pending'),
		error: text('error'),
		version: integer('version').notNull().default(1),
		color: text('color').notNull().default('#d9d9d6'),
		placeholder: text('placeholder'),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [
		uniqueIndex('photos_section_filename_idx').on(t.sectionId, t.filename),
		index('photos_gallery_idx').on(t.galleryId),
		index('photos_status_idx').on(t.status)
	]
);

/** A person who identified themselves with an email in a gallery (for favorites). */
export const visitors = sqliteTable(
	'visitors',
	{
		id: text('id').primaryKey(),
		galleryId: text('gallery_id')
			.notNull()
			.references(() => galleries.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [uniqueIndex('visitors_gallery_email_idx').on(t.galleryId, t.email)]
);

export const favorites = sqliteTable(
	'favorites',
	{
		visitorId: text('visitor_id')
			.notNull()
			.references(() => visitors.id, { onDelete: 'cascade' }),
		photoId: text('photo_id')
			.notNull()
			.references(() => photos.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [primaryKey({ columns: [t.visitorId, t.photoId] })]
);

export const emailTemplates = sqliteTable('email_templates', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	subject: text('subject').notNull(),
	body: text('body').notNull(),
	isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at').notNull().default(now),
	updatedAt: integer('updated_at').notNull().default(now)
});

export type EmailStatus = 'queued' | 'sent' | 'failed';
export type EmailKind = 'gallery' | 'test';

export interface GalleryEmailPayload {
	subject: string;
	body: string;
	includePassword: boolean;
	baseUrl: string;
}

export const emailLog = sqliteTable(
	'email_log',
	{
		id: text('id').primaryKey(),
		kind: text('kind').$type<EmailKind>().notNull(),
		galleryId: text('gallery_id').references(() => galleries.id, { onDelete: 'cascade' }),
		templateId: text('template_id'),
		recipient: text('recipient').notNull(),
		subject: text('subject').notNull(),
		payload: text('payload', { mode: 'json' }).$type<GalleryEmailPayload>(),
		status: text('status').$type<EmailStatus>().notNull().default('queued'),
		attempts: integer('attempts').notNull().default(0),
		nextAttemptAt: integer('next_attempt_at').notNull().default(now),
		error: text('error'),
		createdAt: integer('created_at').notNull().default(now),
		sentAt: integer('sent_at')
	},
	(t) => [index('email_log_gallery_idx').on(t.galleryId), index('email_log_status_idx').on(t.status)]
);

export type Gallery = typeof galleries.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type EmailLogEntry = typeof emailLog.$inferSelect;
