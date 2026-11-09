import type { DownloadSettings, GalleryDesign, GalleryOptions, GalleryStatus, PhotoView } from '$lib/types';

export interface AdminPhoto extends PhotoView {
	status: 'pending' | 'ready' | 'error';
	error: string | null;
	hidden: boolean;
}

export interface AdminSection {
	id: string;
	name: string;
	slug: string;
	sortMode: 'filename' | 'date' | 'manual';
	photos: AdminPhoto[];
}

export interface EditorGallery {
	id: string;
	name: string;
	folder: string;
	slug: string;
	eventDate: string | null;
	status: GalleryStatus;
	missing: boolean;
	coverPhotoId: string | null;
	coverFocalX: number;
	coverFocalY: number;
	password: string | null;
	design: GalleryDesign;
	download: DownloadSettings;
	options: GalleryOptions;
	favoritesEnabled: boolean;
	language: string;
	clientName: string | null;
	clientEmail: string | null;
	tags: string[];
	watermarkId: string | null;
	expiresOn: string | null;
	reminderDays: number | null;
	reminderTo: 'client' | 'all';
	reminderSentAt: number | null;
	warnings: { code: string; section?: string; count?: number }[];
}
