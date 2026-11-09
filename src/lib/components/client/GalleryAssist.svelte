<script lang="ts">
	import { onMount } from 'svelte';
	import Heart from '@lucide/svelte/icons/heart';
	import Download from '@lucide/svelte/icons/download';
	import Share from '@lucide/svelte/icons/share';
	import Images from '@lucide/svelte/icons/images';
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n, type MessageKey } from '$lib/i18n';

	let { galleryId, favorites, downloads }: { galleryId: string; favorites: boolean; downloads: boolean } = $props();
	const { t } = useI18n();

	// svelte-ignore state_referenced_locally
	const storageKey = `folio-assist:${galleryId}`;
	let open = $state(false);
	let step = $state(0);

	// svelte-ignore state_referenced_locally
	const cards = [
		{ icon: Images, title: 'client.assist.browseTitle', text: 'client.assist.browseText' },
		...(favorites ? [{ icon: Heart, title: 'client.assist.favoritesTitle', text: 'client.assist.favoritesText' }] : []),
		...(downloads ? [{ icon: Download, title: 'client.assist.downloadTitle', text: 'client.assist.downloadText' }] : []),
		{ icon: Share, title: 'client.assist.shareTitle', text: 'client.assist.shareText' }
	] as { icon: typeof Heart; title: MessageKey; text: MessageKey }[];

	onMount(() => {
		try {
			if (!localStorage.getItem(storageKey)) open = true;
		} catch {
			// storage unavailable: do not show the cards
		}
	});

	function finish() {
		open = false;
		try {
			localStorage.setItem(storageKey, '1');
		} catch {
			// ignore
		}
	}

	const card = $derived(cards[step]);
</script>

{#if open}
	<Modal title={t('client.assist.title')} onclose={finish}>
		<div class="card">
			<span class="icon"><card.icon size={28} strokeWidth={1.25} /></span>
			<h3>{t(card.title)}</h3>
			<p>{t(card.text)}</p>
		</div>
		<div class="dots" aria-hidden="true">
			{#each cards as _, i (i)}<span class:active={i === step}></span>{/each}
		</div>
		<div class="actions">
			<button type="button" class="ghost label" onclick={finish}>{t('client.assist.skip')}</button>
			{#if step < cards.length - 1}
				<button type="button" class="primary label" onclick={() => (step += 1)}>{t('client.assist.next')}</button>
			{:else}
				<button type="button" class="primary label" onclick={finish}>{t('client.assist.done')}</button>
			{/if}
		</div>
	</Modal>
{/if}

<style>
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-3);
		padding: var(--space-3) 0 var(--space-5);
	}

	.icon {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--color-surface);
	}

	h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	p {
		margin: 0;
		color: var(--color-text-muted);
		max-width: 34ch;
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 6px;
		margin-bottom: var(--space-5);
	}

	.dots span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-border);
	}

	.dots span.active {
		background: var(--color-text);
	}

	.actions {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.actions button {
		height: 48px;
		padding: 0 var(--space-5);
		border: 0;
	}

	.ghost {
		background: none;
		color: var(--color-text-muted);
	}

	.primary {
		flex: 1;
		background: var(--color-text);
		color: var(--color-bg);
	}
</style>
