<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Upload from '@lucide/svelte/icons/upload';
	import Star from '@lucide/svelte/icons/star';
	import Trash from '@lucide/svelte/icons/trash-2';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Grid2 from '@lucide/svelte/icons/images';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Eye from '@lucide/svelte/icons/eye';
	import X from '@lucide/svelte/icons/x';
	import { SvelteSet } from 'svelte/reactivity';
	import { callAction } from '$lib/admin-actions';
	import ShareLinkDialog from './ShareLinkDialog.svelte';
	import { uploadFile, type DuplicatePolicy } from '$lib/admin-upload';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { displayUrl } from '$lib/types';
	import type { AdminSection, EditorGallery } from './editor-types';

	interface Props {
		gallery: EditorGallery;
		section: AdminSection | null;
		sections: AdminSection[];
		stats: { total: number; ready: number; pending: number; failed: number };
		baseUrl: string;
	}

	let { gallery, section, sections, stats, baseUrl }: Props = $props();
	let linkFor = $state<string[] | null>(null);
	let query = $state('');
	const { t } = useI18n();

	let large = $state(false);
	let dropping = $state(false);
	let uploading = $state<{ done: number; total: number; failed: number; skipped: number; bytes: number; totalBytes: number } | null>(null);
	let duplicate = $state<DuplicatePolicy>('skip');
	const selected = new SvelteSet<string>();
	let lastClicked: string | null = null;
	let target = $state('');

	// Remember the duplicate choice in this browser.
	$effect(() => {
		try {
			const stored = localStorage.getItem('folio-duplicate');
			if (stored === 'skip' || stored === 'replace' || stored === 'rename') duplicate = stored;
		} catch {
			// ignore
		}
	});
	let order = $state<string[]>([]);
	let dragId = $state<string | null>(null);
	let fileInput: HTMLInputElement;

	$effect(() => {
		order = section?.photos.map((p) => p.id) ?? [];
	});
	const searching = $derived(query.trim().length > 0);
	const photos = $derived(
		searching
			? sections.flatMap((s) => s.photos).filter((p) => p.filename.toLowerCase().includes(query.trim().toLowerCase()))
			: order.map((id) => section?.photos.find((p) => p.id === id)).filter((p) => p !== undefined)
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
		const files = items.filter((i) => IMAGE.test(i.file.name) && !i.file.name.startsWith('.') && i.file.size > 0);
		if (files.length === 0) return;
		const totalBytes = files.reduce((sum, i) => sum + i.file.size, 0);
		uploading = { done: 0, total: files.length, failed: 0, skipped: 0, bytes: 0, totalBytes };
		let firstNewSection: string | null = null;
		const queue = [...files];

		async function worker() {
			for (let item = queue.shift(); item; item = queue.shift()) {
				const targetSection = item.folder
					? { newSection: item.folder }
					: section
						? { sectionId: section.id }
						: { newSection: t('admin.editor.defaultSection') };
				let reported = 0;
				try {
					const result = await uploadFile(gallery.id, item.file, targetSection, duplicate, (bytes) => {
						uploading!.bytes += bytes - reported;
						reported = bytes;
					});
					if (result.skipped) uploading!.skipped += 1;
					if (!section || item.folder) firstNewSection ??= result.sectionId;
				} catch {
					uploading!.failed += 1;
				}
				uploading!.done += 1;
			}
		}

		await Promise.all([worker(), worker(), worker()]);
		const { failed, skipped } = uploading;
		uploading = null;
		if (failed > 0) toast(t('admin.editor.uploadFailed', { count: failed }), 'error');
		if (skipped > 0) toast(t('admin.editor.uploadSkipped', { count: skipped }));
		// Give the library scan a moment to register the new files.
		setTimeout(async () => {
			await invalidateAll();
			if (firstNewSection) goto(`?tab=photos&section=${firstNewSection}`, { noScroll: true, replaceState: true });
		}, 1200);
	}

	function setDuplicate(event: Event) {
		duplicate = (event.currentTarget as HTMLSelectElement).value as DuplicatePolicy;
		try {
			localStorage.setItem('folio-duplicate', duplicate);
		} catch {
			// ignore
		}
	}

	function toggleSelect(id: string, event: MouseEvent) {
		if (event.shiftKey && lastClicked) {
			const ids = photos.map((p) => p.id);
			const [a, b] = [ids.indexOf(lastClicked), ids.indexOf(id)].sort((x, y) => x - y);
			if (a >= 0 && b >= 0) for (const pid of ids.slice(a, b + 1)) selected.add(pid);
		} else if (selected.has(id)) selected.delete(id);
		else selected.add(id);
		lastClicked = id;
	}

	async function bulk(action: 'hide' | 'show' | 'delete' | 'move' | 'copy') {
		const ids = [...selected];
		if (ids.length === 0) return;
		if (action === 'delete' && !confirm(t('admin.bulk.deleteConfirm', { count: ids.length }))) return;
		let result;
		if (action === 'hide' || action === 'show') result = await callAction('hidePhotos', { ids, hidden: action === 'hide' });
		else if (action === 'delete') result = await deletePhotos(ids);
		else {
			if (!target) return;
			result = await callAction('movePhotos', { ids, sectionId: target, mode: action });
		}
		if (result.type === 'success') {
			selected.clear();
			target = '';
			toast(t('common.saved'));
		} else toast(t('common.error'), 'error');
	}

	function downloadSelected() {
		const a = document.createElement('a');
		a.href = `/admin/api/galleries/${gallery.id}/download?ids=${[...selected].join(',')}`;
		a.download = '';
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	async function toggleHidden(id: string, hidden: boolean) {
		await callAction('hidePhotos', { ids: [id], hidden });
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
		await deletePhotos([id]);
	}

	/** Delete, asking again when photos are part of orders that are not finished. */
	async function deletePhotos(ids: string[]) {
		const result = await callAction('deletePhotos', { ids });
		if (result.type === 'failure' && result.status === 409) {
			const count = (result.data as { inOrders?: number } | undefined)?.inOrders ?? 0;
			if (!confirm(t('admin.store.photoInOrder', { count }))) return result;
			return callAction('deletePhotos', { ids, force: true });
		}
		return result;
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
			<label class="search">
				<span class="visually-hidden">{t('admin.editor.search')}</span>
				<input type="search" bind:value={query} placeholder={t('admin.editor.search')} />
			</label>
			{#if section && !searching}
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
			<label class="duplicate">
				<span class="visually-hidden">{t('admin.upload.duplicates')}</span>
				<select value={duplicate} onchange={setDuplicate} title={t('admin.upload.duplicates')}>
					<option value="skip">{t('admin.upload.skip')}</option>
					<option value="replace">{t('admin.upload.replace')}</option>
					<option value="rename">{t('admin.upload.rename')}</option>
				</select>
			</label>
			<button class="btn primary" type="button" onclick={() => fileInput.click()} disabled={uploading !== null}>
				<Upload size={16} />{t('admin.editor.upload')}
			</button>
			<input bind:this={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onchange={onFiles} />
		</div>
	</div>

	{#if uploading}
		<div class="upload-progress" role="status">
			<span>{t('admin.editor.uploading', { done: uploading.done, total: uploading.total })}</span>
			<div class="bar"><div style:width="{(uploading.bytes / Math.max(1, uploading.totalBytes)) * 100}%"></div></div>
		</div>
	{/if}

	{#if selected.size > 0}
		<div class="bulk card" role="toolbar" aria-label={t('admin.bulk.title')}>
			<strong>{t('admin.bulk.selected', { count: selected.size })}</strong>
			<div class="row">
				<select bind:value={target} aria-label={t('admin.bulk.target')}>
					<option value="">{t('admin.bulk.target')}</option>
					{#each sections as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
				</select>
				<button class="btn small" type="button" disabled={!target} onclick={() => bulk('move')}>{t('admin.bulk.move')}</button>
				<button class="btn small" type="button" disabled={!target} onclick={() => bulk('copy')}>{t('admin.bulk.copy')}</button>
				<button class="btn small" type="button" onclick={() => bulk('hide')}><EyeOff size={14} />{t('admin.bulk.hide')}</button>
				<button class="btn small" type="button" onclick={() => bulk('show')}><Eye size={14} />{t('admin.bulk.show')}</button>
				<button class="btn small" type="button" onclick={downloadSelected}>{t('admin.bulk.download')}</button>
				<button class="btn small" type="button" onclick={() => (linkFor = [...selected])}>{t('admin.links.create')}</button>
				<button class="btn small danger" type="button" onclick={() => bulk('delete')}><Trash size={14} />{t('common.delete')}</button>
				<button class="icon-btn" type="button" onclick={() => selected.clear()} aria-label={t('admin.bulk.clear')}><X size={16} /></button>
			</div>
		</div>
	{/if}

	{#if searching && photos.length === 0}
		<p class="hint">{t('admin.editor.noMatches')}</p>
	{:else if photos.length === 0}
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
					class:hidden-photo={photo.hidden}
					class:is-selected={selected.has(photo.id)}
					class:selecting={selected.size > 0}
					draggable={!searching && selected.size === 0}
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
						<label class="select" title={t('admin.bulk.select')}>
							<input
								type="checkbox"
								checked={selected.has(photo.id)}
								onclick={(e) => {
									e.preventDefault();
									toggleSelect(photo.id, e);
								}}
								aria-label={t('admin.bulk.select')}
							/>
						</label>
						{#if photo.hidden}<span class="badge hidden-badge"><EyeOff size={12} />{t('admin.bulk.hidden')}</span>{/if}
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
							<button
								type="button"
								class="icon-btn"
								onclick={() => toggleHidden(photo.id, !photo.hidden)}
								title={photo.hidden ? t('admin.bulk.show') : t('admin.bulk.hide')}
								aria-label={photo.hidden ? t('admin.bulk.show') : t('admin.bulk.hide')}
								>{#if photo.hidden}<Eye size={16} />{:else}<EyeOff size={16} />{/if}</button
							>
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

{#if linkFor}
	<ShareLinkDialog photoIds={linkFor} {baseUrl} onclose={() => (linkFor = null)} />
{/if}

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

	.search input {
		width: 200px;
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
		bottom: 6px;
		right: 6px;
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

	.select {
		position: absolute;
		top: 6px;
		left: 6px;
		z-index: 2;
		display: none;
		padding: 4px;
		border-radius: 4px;
		background: var(--panel);
	}

	.select input {
		width: 16px;
		height: 16px;
		margin: 0;
		accent-color: var(--accent);
	}

	li:hover .select,
	li.selecting .select,
	li.is-selected .select {
		display: block;
	}

	li.is-selected .thumb {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	li.hidden-photo img {
		opacity: 0.4;
	}

	.hidden-badge {
		position: absolute;
		bottom: 6px;
		left: 6px;
	}

	.bulk {
		position: sticky;
		top: 64px;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 10px 14px;
	}

	.bulk select {
		width: auto;
		min-height: 32px;
		padding: 4px 8px;
	}

	.duplicate select {
		width: auto;
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
