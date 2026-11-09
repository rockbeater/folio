import crypto from 'node:crypto';
import { error, redirect } from '@sveltejs/kit';
import { unlockGallery } from '$lib/server/access';
import { getGalleryBySlug } from '$lib/server/galleries';
import { rateLimit, resetRateLimit } from '$lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => redirect(303, `/g/${params.slug}`);

function safeRedirect(slug: string, value: FormDataEntryValue | null): string {
	const target = typeof value === 'string' ? value : '';
	return target.startsWith(`/g/${slug}`) && !target.startsWith('//') ? target : `/g/${slug}`;
}

function equal(a: string, b: string): boolean {
	const x = crypto.createHash('sha256').update(a).digest();
	const y = crypto.createHash('sha256').update(b).digest();
	return crypto.timingSafeEqual(x, y);
}

export const actions: Actions = {
	default: async ({ params, request, cookies, url, getClientAddress }) => {
		const gallery = getGalleryBySlug(params.slug);
		if (!gallery || gallery.status !== 'published' || gallery.missing) error(404, 'not-found');
		const form = await request.formData();
		const target = safeRedirect(gallery.slug, form.get('redirectTo'));
		if (!gallery.password) redirect(303, target);

		const key = `unlock:${getClientAddress()}:${gallery.id}`;
		if (!rateLimit(key, 10, 15 * 60 * 1000)) redirect(303, `${target}?error=tooMany`);

		const password = String(form.get('password') ?? '').trim();
		if (!equal(password, gallery.password)) redirect(303, `${target}?error=wrong`);

		resetRateLimit(key);
		unlockGallery(cookies, url, gallery);
		redirect(303, target);
	}
};
