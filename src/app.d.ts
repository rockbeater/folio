import type { AdminUser } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			admin: AdminUser | null;
			/** Language of the page being rendered (sets <html lang>). */
			lang: string;
			/** The visitor's IP address (the real one when behind a local reverse proxy). */
			ip: string;
		}
		interface PageState {
			/** Photo open in the lightbox (shallow routing). */
			photo?: string;
			/** The lightbox was opened as a slideshow. */
			slideshow?: boolean;
		}
	}
}

export {};
