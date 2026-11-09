import type { DownloadSettings, GalleryDesign, GalleryStatus, PhotoView } from '$lib/types';

export interface AdminPhoto extends PhotoView {
	status: 'pending' | 'ready' | 'error';
	error: string | null;
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
	favoritesEnabled: boolean;
	clientName: string | null;
	clientEmail: string | null;
	warnings: { code: string; section?: string; count?: number }[];
}
