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
}

export const DEFAULT_DOWNLOAD: DownloadSettings = {
	enabled: true,
	highRes: true,
	highResSize: 'original',
	web: true,
	webSize: '2048'
};

export function normalizeDownload(input: unknown): DownloadSettings {
	const d = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	return {
		enabled: typeof d.enabled === 'boolean' ? d.enabled : DEFAULT_DOWNLOAD.enabled,
		highRes: typeof d.highRes === 'boolean' ? d.highRes : DEFAULT_DOWNLOAD.highRes,
		highResSize: HIGH_RES_SIZES.includes(d.highResSize as HighResSize)
			? (d.highResSize as HighResSize)
			: DEFAULT_DOWNLOAD.highResSize,
		web: typeof d.web === 'boolean' ? d.web : DEFAULT_DOWNLOAD.web,
		webSize: WEB_SIZES.includes(d.webSize as WebSize) ? (d.webSize as WebSize) : DEFAULT_DOWNLOAD.webSize
	};
}

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
	version: number;
	ready: boolean;
}

export interface SectionView {
	id: string;
	name: string;
	slug: string;
	count: number;
}

export function displayUrl(photo: { id: string; version: number }, width: DisplayWidth): string {
	return `/img/${photo.id}/${photo.version}/w${width}.webp`;
}

export function displaySrcset(photo: { id: string; version: number; width: number }): string {
	const widths = DISPLAY_WIDTHS.filter((w, i) => i === 0 || w <= photo.width * 1.2);
	return widths.map((w) => `${displayUrl(photo, w)} ${Math.min(w, photo.width)}w`).join(', ');
}

export const SUPPORTED_LANGUAGES = ['en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
