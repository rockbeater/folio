// Types shared between server and client.

export type GalleryStatus = 'draft' | 'published' | 'hidden';

export type CoverLayout = 'center' | 'bottom' | 'split' | 'frame' | 'none';
export type GridStyle = 'vertical' | 'horizontal';
export type GridSize = 'regular' | 'large';
export type ThemeName = 'light' | 'sand' | 'dark' | 'black';
export type FontSet = 'modern' | 'classic' | 'editorial' | 'minimal';
export type NavStyle = 'icon' | 'icon-text';

export interface GalleryDesign {
	cover: CoverLayout;
	gridStyle: GridStyle;
	thumbSize: GridSize;
	gridSpacing: GridSize;
	theme: ThemeName;
	fonts: FontSet;
	navStyle: NavStyle;
}

export const DEFAULT_DESIGN: GalleryDesign = {
	cover: 'center',
	gridStyle: 'vertical',
	thumbSize: 'regular',
	gridSpacing: 'regular',
	theme: 'light',
	fonts: 'modern',
	navStyle: 'icon'
};

export const COVER_LAYOUTS: CoverLayout[] = ['center', 'bottom', 'split', 'frame', 'none'];
export const GRID_STYLES: GridStyle[] = ['vertical', 'horizontal'];
export const GRID_SIZES: GridSize[] = ['regular', 'large'];
export const THEMES: ThemeName[] = ['light', 'sand', 'dark', 'black'];
export const FONT_SETS: FontSet[] = ['modern', 'classic', 'editorial', 'minimal'];
export const NAV_STYLES: NavStyle[] = ['icon', 'icon-text'];

/** Merge a partial/unknown design object onto the defaults, dropping invalid values. */
export function normalizeDesign(input: unknown): GalleryDesign {
	const d = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
		typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
	return {
		cover: pick(d.cover, COVER_LAYOUTS, DEFAULT_DESIGN.cover),
		gridStyle: pick(d.gridStyle, GRID_STYLES, DEFAULT_DESIGN.gridStyle),
		thumbSize: pick(d.thumbSize, GRID_SIZES, DEFAULT_DESIGN.thumbSize),
		gridSpacing: pick(d.gridSpacing, GRID_SIZES, DEFAULT_DESIGN.gridSpacing),
		theme: pick(d.theme, THEMES, DEFAULT_DESIGN.theme),
		fonts: pick(d.fonts, FONT_SETS, DEFAULT_DESIGN.fonts),
		navStyle: pick(d.navStyle, NAV_STYLES, DEFAULT_DESIGN.navStyle)
	};
}

export type HighResSize = 'original' | '3600';
export type WebSize = '2048' | '1024' | '640';
export const HIGH_RES_SIZES: HighResSize[] = ['original', '3600'];
export const WEB_SIZES: WebSize[] = ['2048', '1024', '640'];

export interface DownloadSettings {
	enabled: boolean;
	highRes: boolean;
	highResSize: HighResSize;
	web: boolean;
	webSize: WebSize;
	/** 4-digit PIN visitors must enter before downloading, or null. */
	pin: string | null;
	/** Ask for the visitor's email before downloading. */
	requireEmail: boolean;
	/** Allow downloading single photos (in addition to "download all"). */
	single: boolean;
	/** Only these sections can be downloaded; null means all sections. */
	sections: string[] | null;
	/** Apply the gallery watermark to web-size downloads. */
	watermarkWeb: boolean;
}

export const DEFAULT_DOWNLOAD: DownloadSettings = {
	enabled: true,
	highRes: true,
	highResSize: 'original',
	web: true,
	webSize: '2048',
	pin: null,
	requireEmail: false,
	single: true,
	sections: null,
	watermarkWeb: false
};

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

export function normalizeDownload(input: unknown): DownloadSettings {
	const d = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	return {
		enabled: bool(d.enabled, DEFAULT_DOWNLOAD.enabled),
		highRes: bool(d.highRes, DEFAULT_DOWNLOAD.highRes),
		highResSize: HIGH_RES_SIZES.includes(d.highResSize as HighResSize)
			? (d.highResSize as HighResSize)
			: DEFAULT_DOWNLOAD.highResSize,
		web: bool(d.web, DEFAULT_DOWNLOAD.web),
		webSize: WEB_SIZES.includes(d.webSize as WebSize) ? (d.webSize as WebSize) : DEFAULT_DOWNLOAD.webSize,
		pin: typeof d.pin === 'string' && /^\d{4}$/.test(d.pin) ? d.pin : null,
		requireEmail: bool(d.requireEmail, DEFAULT_DOWNLOAD.requireEmail),
		single: bool(d.single, DEFAULT_DOWNLOAD.single),
		sections: Array.isArray(d.sections) ? d.sections.filter((x): x is string => typeof x === 'string') : null,
		watermarkWeb: bool(d.watermarkWeb, DEFAULT_DOWNLOAD.watermarkWeb)
	};
}

/** Whether single photos may be downloaded (from the grid or lightbox) in a section. */
export function canDownloadPhoto(d: DownloadSettings, sectionId: string | null): boolean {
	if (!d.enabled || !d.single || !(d.highRes || d.web)) return false;
	return !d.sections || (sectionId !== null && d.sections.includes(sectionId));
}

/** Client-facing gallery options (Settings → General). */
export interface GalleryOptions {
	/** Visitors enter their email before they can see the gallery. */
	emailRegistration: boolean;
	/** Short intro cards for first-time visitors. */
	galleryAssist: boolean;
	slideshow: boolean;
	showFilenames: boolean;
	/** Show the studio's announcement banner (if one is set up). */
	banner: boolean;
}

export const DEFAULT_OPTIONS: GalleryOptions = {
	emailRegistration: false,
	galleryAssist: false,
	slideshow: true,
	showFilenames: false,
	banner: true
};

export function normalizeOptions(input: unknown): GalleryOptions {
	const d = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	return {
		emailRegistration: bool(d.emailRegistration, DEFAULT_OPTIONS.emailRegistration),
		galleryAssist: bool(d.galleryAssist, DEFAULT_OPTIONS.galleryAssist),
		slideshow: bool(d.slideshow, DEFAULT_OPTIONS.slideshow),
		showFilenames: bool(d.showFilenames, DEFAULT_OPTIONS.showFilenames),
		banner: bool(d.banner, DEFAULT_OPTIONS.banner)
	};
}

export type WatermarkPosition =
	| 'center'
	| 'top-left'
	| 'top'
	| 'top-right'
	| 'left'
	| 'right'
	| 'bottom-left'
	| 'bottom'
	| 'bottom-right'
	| 'tile';

export const WATERMARK_POSITIONS: WatermarkPosition[] = [
	'top-left',
	'top',
	'top-right',
	'left',
	'center',
	'right',
	'bottom-left',
	'bottom',
	'bottom-right',
	'tile'
];

/** Size choices a visitor may pick when downloading. */
export type DownloadChoice = 'highres' | 'web';

/** Widths of the WebP display copies generated for every photo. */
export const DISPLAY_WIDTHS = [480, 960, 1600, 2400] as const;
export type DisplayWidth = (typeof DISPLAY_WIDTHS)[number];

export interface PhotoView {
	id: string;
	sectionId: string;
	filename: string;
	width: number;
	height: number;
	color: string;
	/** Cache key used in image URLs: the photo version, plus the watermark key if one applies. */
	key: string;
	ready: boolean;
}

export interface SectionView {
	id: string;
	name: string;
	slug: string;
	count: number;
}

export function displayUrl(photo: { id: string; key: string }, width: DisplayWidth): string {
	return `/img/${photo.id}/${photo.key}/w${width}.webp`;
}

export function displaySrcset(photo: { id: string; key: string; width: number }): string {
	const widths = DISPLAY_WIDTHS.filter((w, i) => i === 0 || w <= photo.width * 1.2);
	return widths.map((w) => `${displayUrl(photo, w)} ${Math.min(w, photo.width)}w`).join(', ');
}

export const SUPPORTED_LANGUAGES = ['en', 'da'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Language names shown in language pickers, always in their own language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
	en: 'English',
	da: 'Dansk'
};
