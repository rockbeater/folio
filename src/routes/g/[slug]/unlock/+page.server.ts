import { error, redirect } from '@sveltejs/kit';
import { clientPasswordOf, loginClient, samePassword, unlockGallery } from '$lib/server/access';
import { getGalleryBySlug } from '$lib/server/galleries';
import { rateLimit, resetRateLimit } from '$lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => redirect(303, `/g/${params.slug}`);

function safeRedirect(slug: string, value: FormDataEntryValue | null): string {
	const target = typeof value === 'string' ? value : '';
	const allowed = target.startsWith(`/g/${slug}`) || target.startsWith('/l/');
	return allowed && !target.startsWith('//') ? target : `/g/${slug}`;
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
		// The client password opens the gallery too, and logs the client in.
		const clientPassword = clientPasswordOf(gallery);
		const isClientPassword = Boolean(clientPassword) && samePassword(password, clientPassword!);
		if (!isClientPassword && !samePassword(password, gallery.password)) redirect(303, `${target}?error=wrong`);

		resetRateLimit(key);
		unlockGallery(cookies, url, gallery);
		if (isClientPassword) loginClient(cookies, url, gallery);
		redirect(303, target);
	}
};
