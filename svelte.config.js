import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ out: 'build', precompress: true }),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'frame-src': ['self'],
				'frame-ancestors': ['self'],
				// The checkout form redirects to Stripe Checkout; browsers apply form-action to that redirect too.
				'form-action': ['self', 'https://checkout.stripe.com'],
				'base-uri': ['self'],
				'object-src': ['none']
			}
		}
	}
};

export default config;
