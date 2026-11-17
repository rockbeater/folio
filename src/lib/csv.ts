// CSV for spreadsheets. Text from visitors (names, notes, list names) can start with = + - @,
// which Excel and friends would run as a formula when the file is opened. Such cells get a
// leading apostrophe so they are shown as text. Numbers (also amounts like "-12.50") are left as
// they are: a plain number cannot do anything.

const FORMULA = /^[=+\-@\t\r]/;
const NUMBER = /^-?\d+(\.\d+)?$/;

export function csvCell(value: string | number | null | undefined): string {
	if (typeof value === 'number') return String(value);
	const text = String(value ?? '');
	const safe = FORMULA.test(text) && !NUMBER.test(text) ? `'${text}` : text;
	return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
	return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
