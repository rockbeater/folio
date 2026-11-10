<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import {
		batches,
		DEFAULT_DOWNLOAD_PREFS,
		normalizeDownloadPrefs,
		resolveMethod,
		type DownloadMethod,
		type ManifestFile
	} from '$lib/smart-download';

	interface Props {
		/** Returns { files: [{ url, name, bytes }] } for the chosen photos and size. */
		manifestUrl: string;
		/** The same download as ZIP, one URL per part. */
		zipUrls: string[];
		count: number;
		disabled?: boolean;
		onfinished?: () => void;
	}

	let { manifestUrl, zipUrls, count, disabled = false, onfinished }: Props = $props();
	const { t } = useI18n();

	// Decided in the browser (the server cannot know the device); ZIP until then.
	let method = $state<DownloadMethod>('zip');
	onMount(() => {
		method = resolveMethod(normalizeDownloadPrefs(page.data.downloadPrefs ?? DEFAULT_DOWNLOAD_PREFS));
	});
	const batchSize = $derived(normalizeDownloadPrefs(page.data.downloadPrefs).batch);

	type Phase = 'idle' | 'working' | 'ready' | 'done';
	let phase = $state<Phase>('idle');
	let progress = $state({ done: 0, total: 0 });
	let groups = $state<ManifestFile[][]>([]);
	let groupIndex = $state(0);
	let prepared: File[] | null = null;
	let failed = $state(false);

	async function manifest(): Promise<ManifestFile[]> {
		const res = await fetch(manifestUrl);
		if (!res.ok) throw new Error(`manifest ${res.status}`);
		return ((await res.json()) as { files: ManifestFile[] }).files;
	}

	async function fetchFile(file: ManifestFile): Promise<File> {
		const res = await fetch(file.url);
		if (!res.ok) throw new Error(`file ${res.status}`);
		const blob = await res.blob();
		return new File([blob], file.name, { type: blob.type || 'image/jpeg' });
	}

	function fail(err: unknown) {
		console.warn('[folio] download failed', err);
		failed = true;
		phase = 'idle';
		toast(t('client.dl.failed'), 'error', 8000);
	}

	function openUrl(url: string) {
		const a = document.createElement('a');
		a.href = url;
		a.rel = 'noopener';
		a.download = '';
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	function finish(message: string) {
		phase = 'done';
		toast(message);
		onfinished?.();
	}

	// --- Share sheet: prepare a batch, then a tap opens the share sheet with it ----

	async function prepare(index: number) {
		phase = 'working';
		groupIndex = index;
		const group = groups[index];
		progress = { done: 0, total: group.length };
		const files: File[] = [];
		for (const file of group) {
			files.push(await fetchFile(file));
			progress = { done: files.length, total: group.length };
		}
		prepared = files;
		phase = 'ready';
	}

	async function shareBatch() {
		if (!prepared) return;
		try {
			if (!navigator.canShare({ files: prepared })) throw new Error('cannot share these files');
			await navigator.share({ files: prepared });
		} catch (err) {
			// Closing the share sheet is not an error, and when the photo took too long to arrive the
			// browser wants a new tap: either way the batch stays ready behind the button.
			if ((err as Error).name === 'AbortError' || (err as Error).name === 'NotAllowedError') return;
			return fail(err);
		}
		prepared = null;
		if (groupIndex + 1 < groups.length) await prepare(groupIndex + 1).catch(fail);
		else finish(count > 1 ? t('client.dl.allSaved', { count }) : t('client.dl.photoSaved'));
	}

	async function startShare() {
		groups = batches(await manifest(), batchSize);
		await prepare(0);
		// One photo: try to open the share sheet right away (works when the photo arrived quickly).
		if (groups.length === 1 && groups[0].length === 1) await shareBatch();
	}

	// --- Folder: write the photos straight into a folder the visitor picks ---------

	async function startFolder() {
		const picker = (window as unknown as { showDirectoryPicker: (o?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
		let dir: FileSystemDirectoryHandle;
		try {
			// Must be the first thing after the tap.
			dir = await picker({ mode: 'readwrite', startIn: 'pictures' });
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			throw err;
		}
		phase = 'working';
		const files = await manifest();
		progress = { done: 0, total: files.length };
		for (const file of files) {
			// A file that is already there is complete (writes are only committed at the end), so a new try resumes.
			const exists = await dir.getFileHandle(file.name).then(
				() => true,
				() => false
			);
			if (!exists) {
				const res = await fetch(file.url);
				if (!res.ok || !res.body) throw new Error(`file ${res.status}`);
				const handle = await dir.getFileHandle(file.name, { create: true });
				const writable = await handle.createWritable();
				await res.body.pipeTo(writable);
			}
			progress = { done: progress.done + 1, total: files.length };
		}
		finish(t('client.dl.folderSaved', { count: files.length }));
	}

	// --- One download per photo ---------------------------------------------------

	async function startFiles() {
		phase = 'working';
		const files = await manifest();
		progress = { done: 0, total: files.length };
		for (const file of files) {
			openUrl(file.url);
			progress = { done: progress.done + 1, total: files.length };
			await new Promise((r) => setTimeout(r, 400));
		}
		finish(files.length > 1 ? t('client.dl.filesStarted', { count: files.length }) : t('client.dl.started'));
	}

	async function start() {
		failed = false;
		try {
			if (method === 'share') await startShare();
			else if (method === 'folder') await startFolder();
			else if (method === 'files') await startFiles();
			else {
				openUrl(zipUrls[0]);
				if (zipUrls.length === 1) finish(t('client.dl.started'));
			}
		} catch (err) {
			fail(err);
		}
	}

	const label = $derived.by(() => {
		if (method === 'share') return count > 1 ? t('client.dl.savePhotos', { count }) : t('client.dl.savePhoto');
		if (method === 'folder') return count > 1 ? t('client.dl.toFolder', { count }) : t('client.dl.start');
		if (method === 'files' && count > 1) return t('client.dl.downloadEach', { count });
		return t('client.dl.start');
	});
	const range = $derived.by(() => {
		const from = groupIndex * batchSize + 1;
		return { from, to: from + (groups[groupIndex]?.length ?? 1) - 1 };
	});
</script>

<div class="smart">
	{#if phase === 'working'}
		<div class="progress" role="status">
			<span class="bar" style:width="{progress.total ? (progress.done / progress.total) * 100 : 0}%"></span>
		</div>
		<p class="hint">
			{method === 'share' && groups.length > 1 ? `${t('client.dl.batch', { part: groupIndex + 1, total: groups.length })} · ` : ''}
			{t(method === 'share' ? 'client.dl.preparing' : 'client.dl.saving', { done: progress.done, total: progress.total })}
		</p>
	{:else if phase === 'ready'}
		<button class="c-btn solid big" type="button" onclick={shareBatch}>
			{groups.length > 1 || count > 1 ? t('client.dl.saveRange', { from: range.from, to: range.to }) : t('client.dl.savePhoto')}
		</button>
		{#if groups.length > 1}<p class="hint">{t('client.dl.batch', { part: groupIndex + 1, total: groups.length })}</p>{/if}
	{:else if phase === 'done'}
		<p class="done">{count > 1 ? t('client.dl.allDone') : t('client.dl.photoSaved')}</p>
	{:else if method === 'zip' && zipUrls.length > 1}
		<p class="hint">{t('client.dl.parts', { count: zipUrls.length })}</p>
		<div class="parts">
			{#each zipUrls as url, i (url)}
				<button class="c-btn solid" type="button" onclick={() => openUrl(url)}>{t('client.dl.part', { part: i + 1, total: zipUrls.length })}</button>
			{/each}
		</div>
	{:else}
		<button class="c-btn solid big" type="button" {disabled} onclick={start}>{label}</button>
	{/if}

	{#if method !== 'zip' && phase !== 'done' && count > 1}
		<button class="fallback" type="button" onclick={() => ((method = 'zip'), (phase = 'idle'))}>
			{failed ? t('client.dl.tryZip') : t('client.dl.useZip')}
		</button>
	{/if}
</div>

<style>
	.smart {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.big {
		width: 100%;
		min-height: 52px;
	}

	.parts {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.progress {
		height: 6px;
		overflow: hidden;
		border-radius: 3px;
		background: var(--color-surface);
	}

	.bar {
		display: block;
		height: 100%;
		background: var(--color-text);
		transition: width var(--dur-ui) var(--ease-out);
	}

	.hint,
	.done {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		text-align: center;
	}

	.done {
		color: var(--color-text);
		font-size: 1rem;
	}

	.fallback {
		align-self: center;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		text-decoration: underline;
	}
</style>
