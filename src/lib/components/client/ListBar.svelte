<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { ListView } from '$lib/types';
	import ShareListDialog from './ShareListDialog.svelte';
	import { getGalleryState } from './gallery-state.svelte';

	let { canShare, privateDefault, canDownload }: { canShare: boolean; privateDefault: boolean; canDownload: boolean } = $props();
	const { t } = useI18n();
	const gs = getGalleryState();

	let sharing = $state<ListView | null>(null);
	let naming = $state<{ mode: 'create' | 'rename'; value: string } | null>(null);
	const active = $derived(gs.activeList);
	const own = $derived(Boolean(active && active.name && !active.preset));

	const title = (l: ListView) => l.name || t('client.lists.default');

	async function activate(id: string) {
		if (id === gs.activeListId) return;
		if (await gs.listAction({ action: 'activate', listId: id })) await invalidateAll();
	}

	async function saveName(event: SubmitEvent) {
		event.preventDefault();
		if (!naming || !naming.value.trim()) return;
		const body =
			naming.mode === 'create'
				? { action: 'create', name: naming.value.trim() }
				: { action: 'rename', listId: gs.activeListId, name: naming.value.trim() };
		const created = naming.mode === 'create';
		naming = null;
		if ((await gs.listAction(body)) && created) await invalidateAll();
	}

	async function remove() {
		if (!active || !confirm(t('client.lists.deleteConfirm', { name: title(active) }))) return;
		if (await gs.listAction({ action: 'delete', listId: active.id })) await invalidateAll();
	}

	async function submit(submitted: boolean) {
		if (!active) return;
		if (await gs.listAction({ action: 'submit', listId: active.id, submitted })) {
			toast(t(submitted ? 'client.lists.submitted' : 'client.lists.reopened'));
		}
	}
</script>

<div class="lists">
	<div class="tabs" role="tablist" aria-label={t('client.lists.title')}>
		{#each gs.lists as list (list.id)}
			<button
				type="button"
				role="tab"
				class="tab"
				aria-selected={list.id === gs.activeListId}
				onclick={() => activate(list.id)}
			>
				<span>{title(list)}</span>
				<span class="count tabular">{list.limit ? t('client.lists.ofLimit', { count: list.count, limit: list.limit }) : list.count}</span>
				{#if list.submitted}<Check size={14} strokeWidth={2} aria-label={t('client.lists.sent')} />{/if}
			</button>
		{/each}
		<button type="button" class="tab add" onclick={() => (naming = { mode: 'create', value: '' })}>
			<Plus size={16} strokeWidth={1.5} />{t('client.lists.new')}
		</button>
	</div>

	{#if naming}
		<form class="name-form" onsubmit={saveName}>
			<!-- svelte-ignore a11y_autofocus -->
			<input class="c-input" bind:value={naming.value} maxlength="60" placeholder={t('client.lists.namePlaceholder')} autofocus aria-label={t('common.name')} />
			<button class="c-btn solid" type="submit">{t('common.save')}</button>
			<button class="c-btn ghost" type="button" onclick={() => (naming = null)}>{t('common.cancel')}</button>
		</form>
	{/if}

	{#if active}
		{#if active.limit}
			<p class="hint">{t('client.lists.limitHint', { limit: active.limit, left: Math.max(0, active.limit - active.count) })}</p>
		{/if}
		<div class="actions">
			{#if active.submitted}
				<button class="c-btn small" type="button" onclick={() => submit(false)}>{t('client.lists.reopen')}</button>
			{:else}
				<button class="c-btn small solid" type="button" disabled={active.count === 0} onclick={() => submit(true)}>{t('client.lists.submit')}</button>
			{/if}
			{#if canShare}
				<button class="c-btn small" type="button" disabled={active.count === 0} onclick={() => (sharing = active)}>
					{active.share ? t('client.lists.shared') : t('client.share.title')}
				</button>
			{/if}
			{#if canDownload && active.count > 0}
				<button class="c-btn small" type="button" onclick={() => (gs.download = { scope: 'list', listId: active.id })}>{t('client.download')}</button>
			{/if}
			{#if own}
				<button class="c-btn small ghost" type="button" onclick={() => (naming = { mode: 'rename', value: active.name })}>{t('common.rename')}</button>
				<button class="c-btn small ghost" type="button" onclick={remove}>{t('common.delete')}</button>
			{/if}
		</div>
	{/if}
</div>

{#if sharing}
	<ShareListDialog list={sharing} {privateDefault} onclose={() => (sharing = null)} />
{/if}

<style>
	.lists {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin: var(--space-3) 0 var(--space-5);
	}

	.tabs {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
		min-height: 40px;
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: none;
		font-size: 0.9375rem;
	}

	.tab[aria-selected='true'] {
		border-color: var(--color-text);
		background: var(--color-text);
		color: var(--color-bg);
	}

	.tab.add {
		border-style: dashed;
		color: var(--color-text-muted);
	}

	.count {
		opacity: 0.7;
		font-size: 0.8125rem;
	}

	.name-form {
		display: flex;
		gap: var(--space-2);
		max-width: 520px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.hint {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
