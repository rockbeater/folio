export type DuplicatePolicy = 'skip' | 'replace' | 'rename';

/** Size of one upload request. Small enough for reverse proxies with body limits. */
const CHUNK_BYTES = 8 * 1024 * 1024;

class PermanentError extends Error {}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload one file in chunks. Failed chunks are retried with back-off, and the
 * upload resumes where the server says it is if a chunk was lost.
 */
export async function uploadFile(
	galleryId: string,
	file: File,
	target: { sectionId?: string; newSection?: string },
	duplicate: DuplicatePolicy,
	onProgress?: (bytes: number) => void
): Promise<{ sectionId: string; skipped: boolean }> {
	if (file.size === 0) throw new PermanentError('Empty file');
	const uploadId = crypto.randomUUID().replace(/-/g, '');
	let sectionId = target.sectionId;
	let offset = 0;
	let attempts = 0;

	for (;;) {
		const end = Math.min(offset + CHUNK_BYTES, file.size);
		const params = new URLSearchParams({
			name: file.name,
			uploadId,
			offset: String(offset),
			total: String(file.size),
			duplicate
		});
		if (sectionId) params.set('section', sectionId);
		else if (target.newSection) params.set('newSection', target.newSection);

		try {
			const res = await fetch(`/admin/api/galleries/${galleryId}/upload?${params}`, {
				method: 'PUT',
				body: file.slice(offset, end)
			});
			if (res.status === 409) {
				const state = (await res.json()) as { received: number; sectionId: string };
				offset = state.received;
				sectionId = state.sectionId;
				continue;
			}
			if (!res.ok) {
				if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
					throw new PermanentError(`Upload refused (${res.status})`);
				}
				throw new Error(`Upload failed (${res.status})`);
			}
			const result = (await res.json()) as
				| { done: false; received: number; sectionId: string }
				| { done: true; skipped: boolean; sectionId: string };
			sectionId = result.sectionId;
			if (result.done) {
				onProgress?.(file.size);
				return { sectionId, skipped: result.skipped };
			}
			offset = result.received;
			attempts = 0;
			onProgress?.(offset);
		} catch (err) {
			if (err instanceof PermanentError) throw err;
			attempts += 1;
			if (attempts > 5) throw err;
			await sleep(800 * 2 ** attempts);
		}
	}
}
