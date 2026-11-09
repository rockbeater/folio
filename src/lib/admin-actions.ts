import { deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { ActionResult } from '@sveltejs/kit';

type Value = string | number | boolean | null | undefined | object;

/** Call a SvelteKit form action on the current page from code. */
export async function callAction(
	name: string,
	data: Record<string, Value> = {},
	options: { invalidate?: boolean } = {}
): Promise<ActionResult> {
	const body = new FormData();
	for (const [key, value] of Object.entries(data)) {
		if (value === undefined || value === null) continue;
		body.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
	}
	const res = await fetch(`?/${name}`, {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true' }
	});
	const result = deserialize(await res.text());
	if (options.invalidate !== false && result.type === 'success') await invalidateAll();
	return result;
}

/** Same alphabet as the server: no look-alike characters. */
export function randomPassword(length = 8): string {
	const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
