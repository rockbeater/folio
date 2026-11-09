const TRANSLITERATIONS: Record<string, string> = {
	æ: 'ae',
	ø: 'oe',
	å: 'aa',
	ä: 'ae',
	ö: 'oe',
	ü: 'ue',
	ß: 'ss',
	þ: 'th',
	ð: 'd',
	œ: 'oe',
	ł: 'l'
};

/**
 * Turn a gallery or section name into a URL slug.
 * Nordic and German letters are transliterated ("Rørvig" -> "roervig"),
 * other accents are stripped, and everything else becomes dashes.
 */
export function slugify(input: string): string {
	const lower = input.toLowerCase();
	let out = '';
	for (const ch of lower) out += TRANSLITERATIONS[ch] ?? ch;
	return (
		out
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80)
			.replace(/-+$/g, '') || 'gallery'
	);
}

/** Return `base`, or `base-2`, `base-3`, … whichever is not taken. */
export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
	if (!taken(base)) return base;
	for (let i = 2; ; i++) {
		const candidate = `${base}-${i}`;
		if (!taken(candidate)) return candidate;
	}
}

/** Natural sort: "IMG_2" before "IMG_10". */
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export function naturalCompare(a: string, b: string): number {
	return collator.compare(a, b);
}
