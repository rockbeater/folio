import { describe, expect, it } from 'vitest';
import { DEFAULT_CARRIERS, normalizeCarriers, trackingUrl } from './carriers';

describe('carriers', () => {
	it('builds tracking links from the carrier list', () => {
		expect(trackingUrl(DEFAULT_CARRIERS, 'postnord', '00073215400763353117')).toBe('https://tracking.postnord.com/dk/tracking?id=00073215400763353117');
		expect(trackingUrl(DEFAULT_CARRIERS, 'gls', 'YPLMC286')).toBe('https://gls-group.eu/DK/da/find-pakke?match=YPLMC286&txtAction=71000');
		// Numbers are escaped, and there is no link without a carrier or a number.
		expect(trackingUrl([{ id: 'x', name: 'X', url: 'https://x.test/t/{tracking_number}' }], 'x', 'A B/1')).toBe('https://x.test/t/A%20B%2F1');
		expect(trackingUrl(DEFAULT_CARRIERS, '', '123')).toBeNull();
		expect(trackingUrl(DEFAULT_CARRIERS, 'gls', '')).toBeNull();
	});

	it('cleans up an edited list', () => {
		const list = normalizeCarriers([
			{ name: '  Local Courier ', url: 'https://courier.test/?n={tracking_number}' },
			{ name: 'Local Courier', url: 'javascript:alert(1)' },
			{ name: '', url: 'https://ignored.test' }
		]);
		expect(list.map((c) => c.id)).toEqual(['local-courier', 'local-courier-2']);
		expect(list[0].name).toBe('Local Courier');
		// Only http(s) addresses are kept.
		expect(list[1].url).toBe('');
		expect(normalizeCarriers(undefined)).toEqual(DEFAULT_CARRIERS);
	});
});
