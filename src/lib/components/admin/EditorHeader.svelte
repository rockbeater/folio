<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Eye from '@lucide/svelte/icons/eye';
	import Link from '@lucide/svelte/icons/link';
	import Mail from '@lucide/svelte/icons/mail';
	import { callAction } from '$lib/admin-actions';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { GalleryStatus } from '$lib/types';
	import type { EditorGallery } from './editor-types';

	let { gallery, baseUrl }: { gallery: EditorGallery; baseUrl: string } = $props();
	const { t } = useI18n();

	const link = $derived(`${baseUrl}/g/${gallery.slug}`);

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
		await callAction('status', { status: (event.currentTarget as HTMLSelectElement).value });
		toast(t('common.saved'));
	}

	async function copyLink() {
		await navigator.clipboard.writeText(link);
		toast(t('admin.editor.linkCopied'));
	}

	const statuses: GalleryStatus[] = ['draft', 'published', 'hidden'];
</script>

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
	</div>
</header>

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

	.status-draft select {
		background-color: var(--warning-soft);
		color: var(--warning);
		border-color: transparent;
	}

	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	@media (max-width: 720px) {
		.actions .btn:not(.primary) {
			padding: 0 10px;
		}
	}
</style>
