import type { AdminUser } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			admin: AdminUser | null;
			/** Language of the page being rendered (sets <html lang>). */
			lang: string;
		}
	}
}

export {};
