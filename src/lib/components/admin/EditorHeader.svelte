<script lang="ts">
	import { goto } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Eye from '@lucide/svelte/icons/eye';
	import Link from '@lucide/svelte/icons/link';
	import Mail from '@lucide/svelte/icons/mail';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Modal from '$lib/components/Modal.svelte';
	import { callAction } from '$lib/admin-actions';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { GalleryStatus } from '$lib/types';
	import type { EditorGallery } from './editor-types';

	interface Props {
		gallery: EditorGallery;
		baseUrl: string;
		presets: { id: string; name: string; isDefault: boolean }[];
		otherGalleries: { id: string; name: string }[];
		/** Sign-ups from the pre-release page, emailed when the gallery is published. */
		releaseWaiting?: number;
	}

	let { gallery, baseUrl, presets, otherGalleries, releaseWaiting = 0 }: Props = $props();
	const { t } = useI18n();

	const link = $derived(`${baseUrl}/g/${gallery.slug}`);
	let menuOpen = $state(false);
	let dialog = $state<'applyPreset' | 'savePreset' | 'copySettings' | 'delete' | null>(null);
	let presetName = $state('');
	let selected = $state('');

	async function saveName(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value.trim();
		if (value && value !== gallery.name) {
			await callAction('meta', { name: value });
			toast(t('common.saved'));
		}
	}

	async function saveDate(event: Event) {
		await callAction('meta', { eventDate: (event.currentTarget as HTMLInputElement).value });
	}

	async function saveStatus(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const status = select.value;
		if (status === 'published' && releaseWaiting > 0 && !confirm(t('admin.prerelease.publishConfirm', { count: releaseWaiting }))) {
			select.value = gallery.status;
			return;
		}
		const result = await callAction('status', { status });
		const released = result.type === 'success' ? Number((result.data as { released?: number } | undefined)?.released ?? 0) : 0;
		toast(released > 0 ? t('admin.prerelease.released', { count: released }) : t('common.saved'));
	}

	async function copyLink() {
		await navigator.clipboard.writeText(link);
		toast(t('admin.editor.linkCopied'));
	}

	function openDialog(name: NonNullable<typeof dialog>) {
		menuOpen = false;
		selected = '';
		presetName = '';
		dialog = name;
	}

	async function run(action: string, data: Record<string, string>, message: MessageKey) {
		const result = await callAction(action, data);
		if (result.type === 'success') {
			toast(t(message));
			dialog = null;
		} else toast(t('common.error'), 'error');
	}

	async function deleteGallery() {
		const res = await fetch('?/deleteGallery', { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await res.text());
		if (result.type === 'redirect') goto(result.location);
		else toast(t('common.error'), 'error');
	}

	const statuses: GalleryStatus[] = ['draft', 'prerelease', 'published', 'hidden'];
</script>

<svelte:window onclick={() => (menuOpen = false)} />

<header class="ed-header">
	<a class="icon-btn" href="/admin" aria-label={t('common.back')}><ArrowLeft size={20} /></a>
	<div class="title">
		<input
			class="name"
			type="text"
			value={gallery.name}
			aria-label={t('common.name')}
			onchange={saveName}
			onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
		/>
		<label class="date">
			<span class="visually-hidden">{t('admin.editor.addDate')}</span>
			<input type="date" value={gallery.eventDate ?? ''} onchange={saveDate} />
		</label>
	</div>
	<label class="status status-{gallery.status}">
		<span class="visually-hidden">Status</span>
		<select value={gallery.status} onchange={saveStatus}>
			{#each statuses as status (status)}
				<option value={status}>{t(`status.${status}` as MessageKey)}</option>
			{/each}
		</select>
	</label>
	<div class="actions">
		<a class="btn" href="/g/{gallery.slug}" target="_blank" rel="noopener"><Eye size={16} />{t('admin.editor.preview')}</a>
		<button class="btn" type="button" onclick={copyLink}><Link size={16} />{t('admin.editor.copyLink')}</button>
		<button class="btn primary" type="button" onclick={() => goto('?tab=email', { noScroll: true })}>
			<Mail size={16} />{t('admin.editor.sendEmail')}
		</button>
		<div class="menu-wrap">
			<button
				class="icon-btn"
				type="button"
				aria-label={t('admin.more.title')}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				onclick={(e) => {
					e.stopPropagation();
					menuOpen = !menuOpen;
				}}><Ellipsis size={20} /></button
			>
			{#if menuOpen}
				<div class="menu card" role="menu">
					<button role="menuitem" type="button" onclick={() => openDialog('applyPreset')} disabled={presets.length === 0}>{t('admin.more.applyPreset')}</button>
					<button role="menuitem" type="button" onclick={() => openDialog('savePreset')}>{t('admin.more.savePreset')}</button>
					<button role="menuitem" type="button" onclick={() => openDialog('copySettings')} disabled={otherGalleries.length === 0}>{t('admin.more.copySettings')}</button>
					<a role="menuitem" href="/admin/api/galleries/{gallery.id}/download" download>{t('admin.more.downloadOriginals')}</a>
					<hr />
					<button role="menuitem" type="button" class="danger" onclick={() => openDialog('delete')}>{t('admin.more.delete')}</button>
				</div>
			{/if}
		</div>
	</div>
</header>

{#if dialog === 'applyPreset'}
	<Modal title={t('admin.more.applyPreset')} onclose={() => (dialog = null)}>
		<div class="stack">
			<p class="hint">{t('admin.more.applyPresetHint')}</p>
			<select bind:value={selected} aria-label={t('admin.presets.title')}>
				<option value="" disabled>{t('admin.more.choose')}</option>
				{#each presets as preset (preset.id)}<option value={preset.id}>{preset.name}</option>{/each}
			</select>
			<button class="btn primary" type="button" disabled={!selected} onclick={() => run('applyPreset', { presetId: selected }, 'admin.more.presetApplied')}>
				{t('admin.more.apply')}
			</button>
		</div>
	</Modal>
{:else if dialog === 'savePreset'}
	<Modal title={t('admin.more.savePreset')} onclose={() => (dialog = null)}>
		<form
			class="stack"
			onsubmit={(e) => {
				e.preventDefault();
				run('saveAsPreset', { name: presetName }, 'admin.more.presetSaved');
			}}
		>
			<p class="hint">{t('admin.more.savePresetHint')}</p>
			<label class="field">
				<span>{t('common.name')}</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input type="text" bind:value={presetName} required autofocus />
			</label>
			<button class="btn primary" type="submit" disabled={!presetName.trim()}>{t('common.save')}</button>
		</form>
	</Modal>
{:else if dialog === 'copySettings'}
	<Modal title={t('admin.more.copySettings')} onclose={() => (dialog = null)}>
		<div class="stack">
			<p class="hint">{t('admin.more.copySettingsHint')}</p>
			<select bind:value={selected} aria-label={t('admin.galleries.title')}>
				<option value="" disabled>{t('admin.more.choose')}</option>
				{#each otherGalleries as other (other.id)}<option value={other.id}>{other.name}</option>{/each}
			</select>
			<button class="btn primary" type="button" disabled={!selected} onclick={() => run('copySettings', { fromId: selected }, 'admin.more.settingsCopied')}>
				{t('admin.more.apply')}
			</button>
		</div>
	</Modal>
{:else if dialog === 'delete'}
	<Modal title={t('admin.more.delete')} onclose={() => (dialog = null)}>
		<div class="stack">
			<p>{t('admin.more.deleteConfirm', { name: gallery.name })}</p>
			<button class="btn primary danger-fill" type="button" onclick={deleteGallery}>{t('admin.more.delete')}</button>
		</div>
	</Modal>
{/if}

<style>
	.ed-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 20px;
		background: var(--panel);
		border-bottom: 1px solid var(--line);
		flex-wrap: wrap;
	}

	.title {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1 1 260px;
	}

	.name {
		min-height: 32px !important;
		padding: 2px 6px !important;
		margin-left: -6px;
		border-color: transparent !important;
		background: transparent !important;
		font-size: 1.125rem !important;
		font-weight: 600;
	}

	.name:hover,
	.name:focus {
		border-color: var(--line) !important;
		background: var(--panel) !important;
	}

	.date input {
		width: auto;
		min-height: 26px !important;
		padding: 0 6px !important;
		margin-left: -6px;
		border-color: transparent !important;
		background: transparent !important;
		color: var(--muted) !important;
		font-size: 0.8125rem !important;
	}

	.date input:hover,
	.date input:focus {
		border-color: var(--line) !important;
	}

	.status select {
		width: auto;
		min-height: 32px;
		padding: 0 28px 0 12px;
		border-radius: 16px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.status-published select {
		background-color: var(--success-soft);
		color: var(--success);
		border-color: transparent;
	}

	.status-prerelease select {
		background-color: var(--accent-soft);
		color: var(--accent);
		border-color: transparent;
	}

	.status-draft select {
		background-color: var(--warning-soft);
		color: var(--warning);
		border-color: transparent;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.menu-wrap {
		position: relative;
	}

	.menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 40;
		display: flex;
		flex-direction: column;
		min-width: 240px;
		padding: 6px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
	}

	.menu button,
	.menu a {
		display: block;
		width: 100%;
		padding: 9px 12px;
		border: 0;
		border-radius: 6px;
		background: none;
		color: inherit;
		text-align: left;
		text-decoration: none;
		font-size: 0.875rem;
	}

	.menu button:hover:not(:disabled),
	.menu a:hover {
		background: var(--admin-bg);
	}

	.menu button:disabled {
		opacity: 0.45;
	}

	.menu hr {
		width: 100%;
		margin: 4px 0;
		border: 0;
		border-top: 1px solid var(--line);
	}

	.danger {
		color: var(--danger) !important;
	}

	.danger-fill {
		background: var(--danger) !important;
		border-color: var(--danger) !important;
	}

	@media (max-width: 720px) {
		.actions .btn:not(.primary) {
			padding: 0 10px;
		}
	}
</style>
