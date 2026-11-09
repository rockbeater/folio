<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Upload from '@lucide/svelte/icons/upload';
	import Star from '@lucide/svelte/icons/star';
	import Trash from '@lucide/svelte/icons/trash-2';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Grid2 from '@lucide/svelte/icons/images';
	import { callAction } from '$lib/admin-actions';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { displayUrl } from '$lib/types';
	import type { AdminSection, EditorGallery } from './editor-types';

	interface Props {
		gallery: EditorGallery;
		section: AdminSection | null;
		stats: { total: number; ready: number; pending: number; failed: number };
	}

	let { gallery, section, stats }: Props = $props();
	const { t } = useI18n();

	let large = $state(false);
	let dropping = $state(false);
	let uploading = $state<{ done: number; total: number; failed: number } | null>(null);
	let order = $state<string[]>([]);
	let dragId = $state<string | null>(null);
	let fileInput: HTMLInputElement;

	$effect(() => {
		order = section?.photos.map((p) => p.id) ?? [];
	});
	const photos = $derived(
		order.map((id) => section?.photos.find((p) => p.id === id)).filter((p) => p !== undefined)
	);

	const IMAGE = /\.(jpe?g|png|webp)$/i;

	interface Pending {
		file: File;
		folder: string | null;
	}

	function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
		return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
	}

	async function walk(entry: FileSystemEntry, folder: string | null, out: Pending[]): Promise<void> {
		if (entry.isFile) {
			const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
			out.push({ file, folder });
		} else if (entry.isDirectory) {
			const reader = (entry as FileSystemDirectoryEntry).createReader();
			for (let batch = await readEntries(reader); batch.length > 0; batch = await readEntries(reader)) {
				for (const child of batch) await walk(child, entry.name, out);
			}
		}
	}

	async function collect(data: DataTransfer): Promise<Pending[]> {
		const entries = [...data.items].map((item) => item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => Boolean(e));
		if (entries.length === 0) return [...data.files].map((file) => ({ file, folder: null }));
		const out: Pending[] = [];
		for (const entry of entries) await walk(entry, null, out);
		return out;
	}

	async function upload(items: Pending[]) {
		const files = items.filter((i) => IMAGE.test(i.file.name) && !i.file.name.startsWith('.'));
		if (files.length === 0) return;
		uploading = { done: 0, total: files.length, failed: 0 };
		let firstNewSection: string | null = null;
		const queue = [...files];

		async function worker() {
			for (let item = queue.shift(); item; item = queue.shift()) {
				const params = new URLSearchParams({ name: item.file.name });
				if (item.folder) params.set('newSection', item.folder);
				else if (section) params.set('section', section.id);
				else params.set('newSection', t('admin.editor.defaultSection'));
				try {
					const res = await fetch(`/admin/api/galleries/${gallery.id}/upload?${params}`, { method: 'PUT', body: item.file });
					if (!res.ok) throw new Error(String(res.status));
					const json = (await res.json()) as { sectionId: string };
					if (!section || item.folder) firstNewSection ??= json.sectionId;
				} catch {
					uploading!.failed += 1;
				}
				uploading!.done += 1;
			}
		}

		await Promise.all([worker(), worker(), worker()]);
		const failed = uploading.failed;
		uploading = null;
		if (failed > 0) toast(t('admin.editor.uploadFailed', { count: failed }), 'error');
		// Give the library scan a moment to register the new files.
		setTimeout(async () => {
			await invalidateAll();
			if (firstNewSection) goto(`?tab=photos&section=${firstNewSection}`, { noScroll: true, replaceState: true });
		}, 1200);
	}

	async function onDrop(event: DragEvent) {
		event.preventDefault();
		dropping = false;
		if (dragId || !event.dataTransfer) return;
		await upload(await collect(event.dataTransfer));
	}

	function onFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		void upload([...(input.files ?? [])].map((file) => ({ file, folder: null })));
		input.value = '';
	}

	async function setSort(event: Event) {
		if (!section) return;
		await callAction('sortMode', { sectionId: section.id, mode: (event.currentTarget as HTMLSelectElement).value });
	}

	async function setCover(id: string) {
		await callAction('cover', { photoId: id });
		toast(t('common.saved'));
	}

	async function remove(id: string) {
		if (!confirm(t('admin.editor.deletePhotoConfirm'))) return;
		await callAction('deletePhotos', { ids: [id] });
	}

	function onDragOver(event: DragEvent, overId: string) {
		if (!dragId || dragId === overId) return;
		event.preventDefault();
		const next = [...order];
		next.splice(next.indexOf(dragId), 1);
		next.splice(next.indexOf(overId), 0, dragId);
		order = next;
	}

	async function onPhotoDrop() {
		if (!dragId || !section) return;
		dragId = null;
		await callAction('reorderPhotos', { sectionId: section.id, ids: order });
	}

	function warningText(w: { code: string; section?: string; count?: number }) {
		return t(`warning.${w.code}` as MessageKey, { section: w.section ?? '', count: w.count ?? 0 });
	}
</script>

<div
	class="panel"
	role="region"
	aria-label={section?.name ?? t('admin.editor.tabPhotos')}
	ondragover={(e) => {
		if (dragId) return;
		e.preventDefault();
		dropping = true;
	}}
	ondragleave={(e) => {
		if (e.currentTarget === e.target) dropping = false;
	}}
	ondrop={onDrop}
>
	{#if gallery.missing}
		<div class="alert error"><TriangleAlert size={18} /><p>{t('admin.editor.missing')}</p></div>
	{/if}
	{#if gallery.warnings.length > 0}
		<div class="alert">
			<TriangleAlert size={18} />
			<div>
				<p><strong>{t('admin.editor.warnings')}</strong></p>
				{#each gallery.warnings as w, i (i)}<p>{warningText(w)}</p>{/each}
			</div>
		</div>
	{/if}

	<div class="toolbar">
		<div>
			<h2>{section?.name ?? t('admin.editor.tabPhotos')}</h2>
			{#if stats.pending > 0}
				<p class="hint progress">
					<LoaderCircle size={14} class="spin" />
					{t('admin.editor.processing', { done: stats.ready + stats.failed, total: stats.total })}
				</p>
			{/if}
		</div>
		<div class="row">
			{#if section}
				<label class="sort">
					<span class="visually-hidden">{t('admin.editor.sort')}</span>
					<select value={section.sortMode} onchange={setSort}>
						<option value="filename">{t('admin.editor.sort')}: {t('admin.editor.sortFilename')}</option>
						<option value="date">{t('admin.editor.sort')}: {t('admin.editor.sortDate')}</option>
						<option value="manual">{t('admin.editor.sort')}: {t('admin.editor.sortManual')}</option>
					</select>
				</label>
			{/if}
			<button
				class="icon-btn"
				type="button"
				onclick={() => (large = !large)}
				aria-label={large ? t('admin.editor.small') : t('admin.editor.large')}
				title={large ? t('admin.editor.small') : t('admin.editor.large')}><Grid2 size={18} /></button
			>
			<button class="btn primary" type="button" onclick={() => fileInput.click()} disabled={uploading !== null}>
				<Upload size={16} />{t('admin.editor.upload')}
			</button>
			<input bind:this={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onchange={onFiles} />
		</div>
	</div>

	{#if uploading}
		<div class="upload-progress" role="status">
			<span>{t('admin.editor.uploading', { done: uploading.done, total: uploading.total })}</span>
			<div class="bar"><div style:width="{(uploading.done / uploading.total) * 100}%"></div></div>
		</div>
	{/if}

	{#if photos.length === 0}
		<button class="dropzone" class:active={dropping} type="button" onclick={() => fileInput.click()}>
			<Upload size={28} strokeWidth={1.5} />
			<strong>{t('admin.editor.dropHere')}</strong>
			<span class="hint">{t('admin.editor.dropHint')}</span>
		</button>
	{:else}
		<ul class="photos" class:large>
			{#each photos as photo (photo.id)}
				<li
					class:dragging={dragId === photo.id}
					draggable="true"
					ondragstart={(e) => {
						dragId = photo.id;
						e.dataTransfer?.setData('text/plain', photo.id);
					}}
					ondragover={(e) => onDragOver(e, photo.id)}
					ondrop={(e) => {
						if (!dragId) return;
						e.stopPropagation();
						void onPhotoDrop();
					}}
					ondragend={onPhotoDrop}
				>
					<div class="thumb">
						{#if photo.status === 'ready'}
							<img src={displayUrl(photo, 480)} alt="" loading="lazy" draggable="false" />
						{:else if photo.status === 'pending'}
							<LoaderCircle size={20} class="spin" />
						{:else}
							<span class="err" title={photo.error ?? ''}><CircleAlert size={20} /> {t('admin.editor.error')}</span>
						{/if}
						{#if gallery.coverPhotoId === photo.id}
							<span class="badge cover">{t('admin.editor.isCover')}</span>
						{/if}
						<div class="tools">
							{#if photo.status === 'ready' && gallery.coverPhotoId !== photo.id}
								<button type="button" class="icon-btn" onclick={() => setCover(photo.id)} title={t('admin.editor.setCover')} aria-label={t('admin.editor.setCover')}
									><Star size={16} /></button
								>
							{/if}
							<button type="button" class="icon-btn" onclick={() => remove(photo.id)} title={t('admin.editor.deletePhoto')} aria-label={t('admin.editor.deletePhoto')}
								><Trash size={16} /></button
							>
						</div>
					</div>
					<span class="filename" title={photo.filename}>{photo.filename}</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if dropping && photos.length > 0}
		<div class="drop-overlay"><Upload size={32} strokeWidth={1.5} /><strong>{t('admin.editor.dropHere')}</strong></div>
	{/if}
</div>

<style>
	.panel {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-height: calc(100vh - 160px);
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	h2 {
		font-size: 1.25rem;
	}

	.progress {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		color: var(--accent);
	}

	.sort select {
		width: auto;
	}

	.upload-progress {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 0.875rem;
	}

	.bar {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--line);
		overflow: hidden;
	}

	.bar div {
		height: 100%;
		background: var(--accent);
		transition: width var(--dur-ui) var(--ease-out);
	}

	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 320px;
		border: 2px dashed var(--line);
		border-radius: 12px;
		background: var(--panel);
		color: var(--muted);
	}

	.dropzone strong {
		color: var(--text);
	}

	.dropzone.active,
	.dropzone:hover {
		border-color: var(--accent);
	}

	.photos {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 16px 12px;
	}

	.photos.large {
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	}

	li {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		cursor: grab;
	}

	li.dragging {
		opacity: 0.4;
	}

	.thumb {
		position: relative;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		color: var(--muted);
		overflow: hidden;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 8px;
	}

	.err {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		color: var(--danger);
		font-size: 0.75rem;
	}

	.badge.cover {
		position: absolute;
		top: 6px;
		left: 6px;
		background: var(--accent);
		color: #fff;
	}

	.tools {
		position: absolute;
		top: 4px;
		right: 4px;
		display: none;
		gap: 2px;
		background: var(--panel);
		border-radius: var(--radius);
	}

	li:hover .tools,
	li:focus-within .tools {
		display: flex;
	}

	.tools .icon-btn {
		width: 30px;
		height: 30px;
	}

	.filename {
		font-size: 0.75rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.drop-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 2px dashed var(--accent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--panel) 88%, transparent);
		color: var(--accent);
		pointer-events: none;
	}
</style>
