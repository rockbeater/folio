import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csv', () => {
	it('quotes text and doubles quotes', () => {
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell(null)).toBe('""');
	});

	it('keeps text that looks like a formula from running', () => {
		expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
		expect(csvCell('+1')).toBe(`"'+1"`);
		expect(csvCell('-2+3')).toBe(`"'-2+3"`);
		expect(csvCell('-12.50')).toBe('"-12.50"');
		expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
	});

	it('writes numbers as numbers, negative ones too', () => {
		expect(csvCell(-250)).toBe('-250');
		expect(toCsv([['a', 1], ['b', -2]])).toBe('"a",1\r\n"b",-2');
	});
});
