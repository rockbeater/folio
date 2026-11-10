import { describe, expect, it } from 'vitest';
import { batches, DEFAULT_BATCH, normalizeDownloadPrefs, RECOMMENDED_METHODS } from './smart-download';

describe('smart download settings', () => {
	it('falls back to the recommended methods and batch size', () => {
		expect(normalizeDownloadPrefs(undefined)).toEqual({ methods: RECOMMENDED_METHODS, batch: DEFAULT_BATCH });
	});

	it('keeps valid choices and ignores methods a device cannot use', () => {
		const prefs = normalizeDownloadPrefs({ methods: { iphone: 'zip', android: 'folder' }, batch: 12 });
		expect(prefs.methods.iphone).toBe('zip');
		expect(prefs.methods.android).toBe(RECOMMENDED_METHODS.android);
		expect(prefs.batch).toBe(12);
		expect(normalizeDownloadPrefs({ batch: 0 }).batch).toBe(DEFAULT_BATCH);
	});

	it('splits a selection into batches', () => {
		expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
	});
});
