<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { ListView } from '$lib/types';
	import { getGalleryState } from './gallery-state.svelte';

	let { list, privateDefault, onclose }: { list: ListView; privateDefault: boolean; onclose: () => void } = $props();
	const { t } = useI18n();
	const gs = getGalleryState();

	// svelte-ignore state_referenced_locally
	let isPrivate = $state(list.share?.private ?? privateDefault);
	let omitted = $state(0);
	let busy = $state(false);
	const current = $derived(gs.lists.find((l) => l.id === list.id) ?? list);
	const link = $derived(current.share ? `${location.origin}/l/${current.share.token}` : '');

	async function share() {
		busy = true;
		const data = await gs.listAction({ action: 'share', listId: list.id, private: isPrivate });
		busy = false;
		if (data) omitted = data.omitted ?? 0;
	}

	async function stop() {
		busy = true;
		await gs.listAction({ action: 'unshare', listId: list.id });
		busy = false;
		toast(t('client.share.stopped'));
	}

	async function copy() {
		await navigator.clipboard.writeText(link);
		toast(t('client.linkCopied'));
	}
</script>

<Modal title={t('client.share.title')} {onclose}>
	<div class="body">
		<p class="intro">{t('client.share.intro')}</p>
		<label class="check">
			<input type="checkbox" bind:checked={isPrivate} onchange={() => current.share && share()} />
			<span>
				<strong>{t('client.share.private')}</strong>
				<small>{isPrivate ? t('client.share.privateHint') : t('client.share.openHint')}</small>
			</span>
		</label>

		{#if current.share}
			<div class="link">
				<input class="c-input" readonly value={link} onfocus={(e) => e.currentTarget.select()} aria-label={t('client.share.link')} />
				<button class="c-btn solid" type="button" onclick={copy}>{t('common.copy')}</button>
			</div>
			{#if omitted > 0}<p class="note">{t('client.share.omitted', { count: omitted })}</p>{/if}
			<p class="note">{t('client.share.live')}</p>
			<button class="c-btn" type="button" disabled={busy} onclick={stop}>{t('client.share.stop')}</button>
		{:else}
			<button class="c-btn solid" type="button" disabled={busy} onclick={share}>{t('client.share.create')}</button>
		{/if}
	</div>
</Modal>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.intro,
	.note {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.9375rem;
	}

	.check {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.check input {
		margin-top: 4px;
	}

	.check span {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.check small {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.link {
		display: flex;
		gap: var(--space-2);
	}
</style>
