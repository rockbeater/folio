import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { libraryState } from '$lib/server/library/scanner';

export function GET() {
	getDb();
	return json({ ok: true, library: libraryState.available });
}
