<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n } from '$lib/i18n';
	import { getGalleryState } from './gallery-state.svelte';

	const { t } = useI18n();
	const gs = getGalleryState();
	// svelte-ignore state_referenced_locally
	const photoId = gs.picking!;
	let name = $state('');
	let busy = $state(false);

	async function toggle(listId: string) {
		busy = true;
		await gs.setInList(photoId, listId, !gs.inList(photoId, listId));
		busy = false;
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;
		busy = true;
		const before = new Set(gs.lists.map((l) => l.id));
		const data = await gs.listAction({ action: 'create', name: name.trim() });
		const created = data?.lists.find((l) => !before.has(l.id));
		if (created) await gs.setInList(photoId, created.id, true);
		name = '';
		busy = false;
	}
</script>

<!-- "Add to which list?" when the visitor has more than one favorite list. -->
<Modal title={t('client.lists.addTo')} onclose={() => (gs.picking = null)}>
	<ul class="lists">
		{#each gs.lists as list (list.id)}
			{@const on = gs.inList(photoId, list.id)}
			<li>
				<button type="button" class="list" class:on aria-pressed={on} disabled={busy} onclick={() => toggle(list.id)}>
					<span class="box">{#if on}<Check size={14} strokeWidth={3} />{/if}</span>
					<span class="name">{list.name || t('client.lists.default')}</span>
					<span class="count tabular">{list.limit ? t('client.lists.ofLimit', { count: list.count, limit: list.limit }) : list.count}</span>
				</button>
			</li>
		{/each}
	</ul>
	<form class="new" onsubmit={create}>
		<input class="c-input" bind:value={name} maxlength="60" placeholder={t('client.lists.namePlaceholder')} aria-label={t('client.lists.new')} />
		<button class="c-btn" type="submit" disabled={busy || !name.trim()}><Plus size={16} />{t('client.lists.new')}</button>
	</form>
	<button class="c-btn solid done" type="button" onclick={() => (gs.picking = null)}>{t('client.lists.done')}</button>
</Modal>

<style>
	.lists {
		display: flex;
		flex-direction: column;
		margin: 0 0 var(--space-4);
		padding: 0;
		list-style: none;
	}

	.list {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-3) 0;
		border: 0;
		border-bottom: 1px solid var(--color-border);
		background: none;
		text-align: left;
		font-size: 1rem;
	}

	.box {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 1px solid var(--color-text);
	}

	.on .box {
		background: var(--color-text);
		color: var(--color-bg);
	}

	.count {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.new {
		display: flex;
		gap: var(--space-2);
	}

	.done {
		width: 100%;
		margin-top: var(--space-4);
	}
</style>
