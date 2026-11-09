import { describe, expect, it } from 'vitest';
import { naturalCompare, slugify, uniqueSlug } from './slug';

describe('slugify', () => {
	it('transliterates Danish letters instead of dropping them', () => {
		expect(slugify('Familiebilleder Rørvig')).toBe('familiebilleder-roervig');
		expect(slugify('Æblehaven på Ærø')).toBe('aeblehaven-paa-aeroe');
	});

	it('strips accents and punctuation', () => {
		expect(slugify('Café & Crème — 2026!')).toBe('cafe-creme-2026');
		expect(slugify('  Anna & Mads  ')).toBe('anna-mads');
	});

	it('never returns an empty slug', () => {
		expect(slugify('!!!')).toBe('gallery');
	});
});

describe('uniqueSlug', () => {
	it('appends a counter when taken', () => {
		const taken = new Set(['wedding', 'wedding-2']);
		expect(uniqueSlug('wedding', (s) => taken.has(s))).toBe('wedding-3');
		expect(uniqueSlug('family', (s) => taken.has(s))).toBe('family');
	});
});

describe('naturalCompare', () => {
	it('sorts numbers naturally', () => {
		expect(['IMG_10.jpg', 'IMG_2.jpg', 'IMG_1.jpg'].sort(naturalCompare)).toEqual([
			'IMG_1.jpg',
			'IMG_2.jpg',
			'IMG_10.jpg'
		]);
	});
});
