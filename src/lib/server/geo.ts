// A starting value for the buyer's country. Folio makes no outside lookups: it uses the country a
// CDN or proxy adds from the visitor's IP address (e.g. Cloudflare), else the browser's language.

/** Headers in which CDNs and proxies pass the country of the visitor's IP address. */
const COUNTRY_HEADERS = ['cf-ipcountry', 'cloudfront-viewer-country', 'x-vercel-ip-country', 'x-appengine-country', 'x-country-code'];

/** Language tags from Accept-Language, most preferred first. */
export function preferredLanguages(header: string | null): string[] {
	if (!header) return [];
	return header
		.split(',')
		.map((part, i) => {
			const [tag, ...params] = part.trim().split(';');
			const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
			return { tag: tag.trim(), q: q ? Number(q.slice(2)) : 1, i };
		})
		.filter((l) => l.tag && l.tag !== '*' && Number.isFinite(l.q) && l.q > 0)
		.sort((a, b) => b.q - a.q || a.i - b.i)
		.map((l) => l.tag);
}

/** The region of a language tag ("da-DK" → DK), or the usual one for the language ("da" → DK). */
export function regionOf(tag: string): string | null {
	try {
		const locale = new Intl.Locale(tag);
		return (locale.region ?? locale.maximize().region ?? null)?.toUpperCase() ?? null;
	} catch {
		return null;
	}
}

/** The visitor's likely country among `allowed`, or null. The buyer can always change it. */
export function guessCountry(headers: Headers, allowed: readonly string[]): string | null {
	const pick = (code: string | null | undefined) => {
		const c = code?.trim().toUpperCase();
		return c && /^[A-Z]{2}$/.test(c) && allowed.includes(c) ? c : null;
	};
	for (const name of COUNTRY_HEADERS) {
		const c = pick(headers.get(name));
		if (c) return c;
	}
	for (const tag of preferredLanguages(headers.get('accept-language'))) {
		const c = pick(regionOf(tag));
		if (c) return c;
	}
	return null;
}
