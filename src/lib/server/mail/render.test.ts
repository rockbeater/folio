import { describe, expect, it } from 'vitest';
import { mergeFields, renderGalleryEmail } from './render';

const values = {
	client_name: '',
	gallery_name: 'Anna & Mads',
	gallery_link: 'https://photos.example.com/g/anna-mads',
	password: 'k3x9pq',
	studio_name: 'Example Studio',
	event_date: 'June 14, 2026'
};

describe('mergeFields', () => {
	it('replaces placeholders and tidies empty ones', () => {
		expect(mergeFields('Hi {client_name}, see {gallery_name}!', values)).toBe('Hi, see Anna & Mads!');
		expect(mergeFields('Unknown {nope} stays', values)).toBe('Unknown {nope} stays');
	});
});

describe('renderGalleryEmail', () => {
	it('escapes user content and includes link, password and cover', () => {
		const { html, text } = renderGalleryEmail({
			language: 'en',
			galleryName: '<b>Anna</b>',
			eventDate: values.event_date,
			message: 'Hello\n\nOpen https://photos.example.com/g/anna-mads',
			link: values.gallery_link,
			password: values.password,
			studio: { name: 'Example Studio', email: 'hi@example.com', phone: '', website: '' },
			coverSrc: 'cid:cover@folio',
			logoSrc: null
		});
		expect(html).toContain('&lt;b&gt;Anna&lt;/b&gt;');
		expect(html).not.toContain('<b>Anna</b>');
		expect(html).toContain('href="https://photos.example.com/g/anna-mads"');
		expect(html).toContain('cid:cover@folio');
		expect(html).toContain('k3x9pq');
		expect(text).toContain('View gallery: https://photos.example.com/g/anna-mads');
		expect(text).toContain('Password: k3x9pq');
	});
});
