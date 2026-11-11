import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { DownloadSettings, GalleryAccess, GalleryDesign, GalleryOptions, GalleryStatus, WatermarkPosition } from '$lib/types';
import type { Crop, DigitalSpec, OrderStatus, PaymentStatus, ProductKind, ProductOption, Variant } from '$lib/store';

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
	/** Base32 TOTP secret when two-factor login is on. */
	totpSecret: text('totp_secret'),
	/** SHA-256 hashes of unused recovery codes. */
	recoveryCodes: text('recovery_codes', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
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
		options: text('options', { mode: 'json' }).$type<GalleryOptions>(),
		access: text('access', { mode: 'json' }).$type<GalleryAccess>(),
		storeEnabled: integer('store_enabled', { mode: 'boolean' }).notNull().default(false),
		priceListId: text('price_list_id'),
		tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
		/** How new sections are sorted; follows the last order chosen for a section, and presets carry it. */
		sortMode: text('sort_mode').$type<GallerySort>().notNull().default('filename'),
		watermarkId: text('watermark_id'),
		/** Last day the gallery is visible (YYYY-MM-DD); it is hidden after that day. */
		expiresOn: text('expires_on'),
		/** Send a reminder this many days before expiry (null: no reminder). */
		reminderDays: integer('reminder_days'),
		reminderTo: text('reminder_to').$type<'client' | 'all'>().notNull().default('client'),
		reminderSentAt: integer('reminder_sent_at'),
		warnings: text('warnings', { mode: 'json' }).$type<ScanWarning[]>().notNull().default(sql`'[]'`),
		createdAt: integer('created_at').notNull().default(now),
		updatedAt: integer('updated_at').notNull().default(now),
		publishedAt: integer('published_at')
	},
	(t) => [index('galleries_folder_idx').on(t.folder)]
);

export type SortMode = 'filename' | 'date' | 'manual';
/** A gallery's sort for new sections: a manual order belongs to one section's photos. */
export type GallerySort = Exclude<SortMode, 'manual'>;

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
		/** Hidden from clients without deleting the file. */
		hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
		/** Marked private by the client: hidden from guests, visible to the client. */
		private: integer('private', { mode: 'boolean' }).notNull().default(false),
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
		/** Signed up on the pre-release page: email them when the gallery is published. */
		notifyOnRelease: integer('notify_on_release', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [uniqueIndex('visitors_gallery_email_idx').on(t.galleryId, t.email)]
);

/** A visitor's named favorite list. Every visitor has a default list (name ''). */
export const favoriteLists = sqliteTable(
	'favorite_lists',
	{
		id: text('id').primaryKey(),
		galleryId: text('gallery_id')
			.notNull()
			.references(() => galleries.id, { onDelete: 'cascade' }),
		visitorId: text('visitor_id')
			.notNull()
			.references(() => visitors.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default(''),
		/** Set when the list comes from one of the gallery's predefined lists. */
		presetId: text('preset_id'),
		submittedAt: integer('submitted_at'),
		/** Long random token for the share link, or null when not shared. */
		shareToken: text('share_token').unique(),
		sharePrivate: integer('share_private', { mode: 'boolean' }).notNull().default(true),
		shareViews: integer('share_views').notNull().default(0),
		shareDownloads: integer('share_downloads').notNull().default(0),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [index('favorite_lists_visitor_idx').on(t.visitorId)]
);

export const favorites = sqliteTable(
	'favorites',
	{
		listId: text('list_id')
			.notNull()
			.references(() => favoriteLists.id, { onDelete: 'cascade' }),
		visitorId: text('visitor_id')
			.notNull()
			.references(() => visitors.id, { onDelete: 'cascade' }),
		photoId: text('photo_id')
			.notNull()
			.references(() => photos.id, { onDelete: 'cascade' }),
		note: text('note'),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [primaryKey({ columns: [t.listId, t.photoId] }), index('favorites_visitor_idx').on(t.visitorId)]
);

export interface ShareDownload {
	enabled: boolean;
	highRes: boolean;
	web: boolean;
}

/** Quick share link: selected photos only, independent of the gallery's password and status. */
export const shareLinks = sqliteTable(
	'share_links',
	{
		id: text('id').primaryKey(),
		token: text('token').notNull().unique(),
		galleryId: text('gallery_id')
			.notNull()
			.references(() => galleries.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		photoIds: text('photo_ids', { mode: 'json' }).$type<string[]>().notNull(),
		download: text('download', { mode: 'json' }).$type<ShareDownload>().notNull(),
		expiresOn: text('expires_on'),
		password: text('password'),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		views: integer('views').notNull().default(0),
		downloads: integer('downloads').notNull().default(0),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [index('share_links_gallery_idx').on(t.galleryId)]
);

export type TemplateKind = 'delivery' | 'reminder' | 'release' | 'order' | 'digital' | 'shipped' | 'refunded';

export const emailTemplates = sqliteTable('email_templates', {
	id: text('id').primaryKey(),
	kind: text('kind').$type<TemplateKind>().notNull().default('delivery'),
	language: text('language').notNull().default('en'),
	name: text('name').notNull(),
	subject: text('subject').notNull(),
	body: text('body').notNull(),
	isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at').notNull().default(now),
	updatedAt: integer('updated_at').notNull().default(now)
});

export type EmailStatus = 'queued' | 'sent' | 'failed';
export type EmailKind = 'gallery' | 'reminder' | 'test' | 'notice' | 'store';

export interface GalleryEmailPayload {
	subject: string;
	body: string;
	includePassword: boolean;
	baseUrl: string;
	/** Store emails: heading, button link and label, and language. */
	title?: string;
	link?: string;
	buttonLabel?: string;
	language?: string;
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
		/** Set when the photographer scheduled the email for later. */
		scheduledFor: integer('scheduled_for'),
		createdAt: integer('created_at').notNull().default(now),
		sentAt: integer('sent_at')
	},
	(t) => [index('email_log_gallery_idx').on(t.galleryId), index('email_log_status_idx').on(t.status)]
);

export type ActivityKind = 'visit' | 'download' | 'registration';

export interface ActivityDetail {
	scope?: string;
	size?: string;
	count?: number;
	sectionId?: string;
	photoId?: string;
}

/** What visitors do in a gallery (visits, downloads, registrations). Favorites live in their own table. */
export const activity = sqliteTable(
	'activity',
	{
		id: text('id').primaryKey(),
		galleryId: text('gallery_id')
			.notNull()
			.references(() => galleries.id, { onDelete: 'cascade' }),
		kind: text('kind').$type<ActivityKind>().notNull(),
		email: text('email'),
		detail: text('detail', { mode: 'json' }).$type<ActivityDetail>(),
		/** IP address of the visitor, logged for downloads. */
		ip: text('ip'),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [index('activity_gallery_kind_idx').on(t.galleryId, t.kind), index('activity_created_idx').on(t.createdAt)]
);

export interface TextWatermark {
	text: string;
	font: string;
	color: string;
}

export const watermarks = sqliteTable('watermarks', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	kind: text('kind').$type<'image' | 'text'>().notNull(),
	/** PNG file inside DATA_DIR/watermarks (text watermarks are rendered to PNG in the browser). */
	file: text('file').notNull(),
	text: text('text', { mode: 'json' }).$type<TextWatermark>(),
	position: text('position').$type<WatermarkPosition>().notNull().default('center'),
	/** Width of the watermark as a fraction of the photo width. */
	scale: real('scale').notNull().default(0.3),
	opacity: real('opacity').notNull().default(0.5),
	version: integer('version').notNull().default(1),
	createdAt: integer('created_at').notNull().default(now)
});

export interface PresetSettings {
	design?: GalleryDesign;
	download?: DownloadSettings;
	options?: GalleryOptions;
	favoritesEnabled?: boolean;
	language?: string;
	watermarkId?: string | null;
	/** Days after creation before the gallery expires (null: never). */
	expiryDays?: number | null;
	reminderDays?: number | null;
	/** Access, list and homepage settings; the client password and sections stay with each gallery. */
	access?: GalleryAccess;
	storeEnabled?: boolean;
	priceListId?: string | null;
	/** Photo order of the sections (by file name or capture date). */
	sortMode?: GallerySort;
}

/** Saved gallery settings that can be applied to galleries; the default is used for new galleries. */
export const presets = sqliteTable('presets', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	settings: text('settings', { mode: 'json' }).$type<PresetSettings>().notNull(),
	isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at').notNull().default(now)
});

// --- Store ------------------------------------------------------------------

export const priceLists = sqliteTable('price_lists', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** Minimum order amount (minor units); 0 for none. */
	minOrder: integer('min_order').notNull().default(0),
	isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at').notNull().default(now)
});

export const products = sqliteTable(
	'products',
	{
		id: text('id').primaryKey(),
		priceListId: text('price_list_id')
			.notNull()
			.references(() => priceLists.id, { onDelete: 'cascade' }),
		category: text('category').notNull().default(''),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		images: text('images', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
		kind: text('kind').$type<ProductKind>().notNull().default('physical'),
		digital: text('digital', { mode: 'json' }).$type<DigitalSpec>(),
		options: text('options', { mode: 'json' }).$type<ProductOption[]>().notNull().default(sql`'[]'`),
		variants: text('variants', { mode: 'json' }).$type<Variant[]>().notNull().default(sql`'[]'`),
		price: integer('price').notNull().default(0),
		extraShipping: integer('extra_shipping').notNull().default(0),
		noPhoto: integer('no_photo', { mode: 'boolean' }).notNull().default(false),
		taxExempt: integer('tax_exempt', { mode: 'boolean' }).notNull().default(false),
		maxOne: integer('max_one', { mode: 'boolean' }).notNull().default(false),
		multiPhoto: integer('multi_photo', { mode: 'boolean' }).notNull().default(false),
		position: integer('position').notNull().default(0),
		createdAt: integer('created_at').notNull().default(now)
	},
	(t) => [index('products_price_list_idx').on(t.priceListId)]
);

export const taxRates = sqliteTable('tax_rates', {
	id: text('id').primaryKey(),
	country: text('country').notNull().unique(),
	/** Basis points: 2500 is 25 %. */
	rate: integer('rate').notNull(),
	shipping: integer('shipping', { mode: 'boolean' }).notNull().default(true),
	digital: integer('digital', { mode: 'boolean' }).notNull().default(true)
});

export const shippingMethods = sqliteTable('shipping_methods', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** ISO country code, or '*' for the rest of the world. */
	country: text('country').notNull(),
	fee: integer('fee').notNull().default(0),
	deliveryTime: text('delivery_time').notNull().default(''),
	pickup: integer('pickup', { mode: 'boolean' }).notNull().default(false),
	position: integer('position').notNull().default(0)
});

export const coupons = sqliteTable('coupons', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** Stored in upper case; matched case-insensitively. */
	code: text('code').notNull().unique(),
	description: text('description').notNull().default(''),
	startsOn: text('starts_on').notNull(),
	endsOn: text('ends_on'),
	percent: integer('percent'),
	amountOff: integer('amount_off'),
	freeShipping: integer('free_shipping', { mode: 'boolean' }).notNull().default(false),
	freeProductId: text('free_product_id'),
	minAmount: integer('min_amount'),
	maxUses: integer('max_uses'),
	oncePerGallery: integer('once_per_gallery', { mode: 'boolean' }).notNull().default(false),
	galleryIds: text('gallery_ids', { mode: 'json' }).$type<string[]>(),
	productIds: text('product_ids', { mode: 'json' }).$type<string[]>(),
	/** Show the code as a banner at the top of galleries. */
	banner: integer('banner', { mode: 'boolean' }).notNull().default(false),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	uses: integer('uses').notNull().default(0),
	createdAt: integer('created_at').notNull().default(now)
});

export interface CartItem {
	id: string;
	productId: string;
	variantKey: string;
	photoId: string | null;
	quantity: number;
	crop: Crop | null;
	/** The buyer has looked at the crop and saved it (required when the photo does not fit the print). */
	cropConfirmed?: boolean;
}

/** A visitor's cart in one gallery, remembered by a cookie across visits. */
export const carts = sqliteTable('carts', {
	id: text('id').primaryKey(),
	galleryId: text('gallery_id')
		.notNull()
		.references(() => galleries.id, { onDelete: 'cascade' }),
	items: text('items', { mode: 'json' }).$type<CartItem[]>().notNull().default(sql`'[]'`),
	couponCode: text('coupon_code'),
	updatedAt: integer('updated_at').notNull().default(now)
});

export interface OrderAddress {
	line1: string;
	line2: string;
	postalCode: string;
	city: string;
	country: string;
}

export const orders = sqliteTable(
	'orders',
	{
		id: text('id').primaryKey(),
		number: integer('number').notNull().unique(),
		/** Secret for the receipt page and digital downloads. */
		token: text('token').notNull().unique(),
		galleryId: text('gallery_id').references(() => galleries.id, { onDelete: 'set null' }),
		galleryName: text('gallery_name').notNull().default(''),
		/** Who placed the order: guests never get private photos in digital downloads. */
		buyerRole: text('buyer_role').$type<'guest' | 'client'>().notNull().default('guest'),
		status: text('status').$type<OrderStatus>().notNull().default('pending'),
		paymentStatus: text('payment_status').$type<PaymentStatus>().notNull().default('unpaid'),
		email: text('email').notNull(),
		name: text('name').notNull(),
		phone: text('phone').notNull().default(''),
		country: text('country').notNull().default(''),
		address: text('address', { mode: 'json' }).$type<OrderAddress>(),
		shippingName: text('shipping_name'),
		currency: text('currency').notNull(),
		language: text('language').notNull().default('en'),
		kind: text('kind').$type<'physical' | 'digital' | 'mixed'>().notNull(),
		subtotal: integer('subtotal').notNull(),
		discount: integer('discount').notNull().default(0),
		shipping: integer('shipping').notNull().default(0),
		tax: integer('tax').notNull().default(0),
		total: integer('total').notNull(),
		refunded: integer('refunded').notNull().default(0),
		couponCode: text('coupon_code'),
		stripeSessionId: text('stripe_session_id'),
		stripePaymentIntent: text('stripe_payment_intent'),
		stripeMode: text('stripe_mode').$type<'test' | 'live' | 'simulated' | 'free'>(),
		tracking: text('tracking'),
		notes: text('notes').notNull().default(''),
		createdAt: integer('created_at').notNull().default(now),
		paidAt: integer('paid_at'),
		updatedAt: integer('updated_at').notNull().default(now)
	},
	(t) => [index('orders_gallery_idx').on(t.galleryId), index('orders_email_idx').on(t.email)]
);

export const orderItems = sqliteTable(
	'order_items',
	{
		id: text('id').primaryKey(),
		orderId: text('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		productId: text('product_id'),
		productName: text('product_name').notNull(),
		variantLabel: text('variant_label').notNull().default(''),
		kind: text('kind').$type<ProductKind>().notNull(),
		digital: text('digital', { mode: 'json' }).$type<DigitalSpec>(),
		photoId: text('photo_id'),
		filename: text('filename'),
		sectionId: text('section_id'),
		crop: text('crop', { mode: 'json' }).$type<Crop>(),
		quantity: integer('quantity').notNull(),
		unitPrice: integer('unit_price').notNull(),
		discount: integer('discount').notNull().default(0),
		taxRate: integer('tax_rate').notNull().default(0),
		tax: integer('tax').notNull().default(0)
	},
	(t) => [index('order_items_order_idx').on(t.orderId), index('order_items_photo_idx').on(t.photoId)]
);

export type Gallery = typeof galleries.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type EmailLogEntry = typeof emailLog.$inferSelect;
export type Watermark = typeof watermarks.$inferSelect;
export type Preset = typeof presets.$inferSelect;
export type FavoriteList = typeof favoriteLists.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type PriceList = typeof priceLists.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Cart = typeof carts.$inferSelect;
