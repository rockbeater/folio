<script lang="ts">
	import { createI18n } from '$lib/i18n';

	let { data } = $props();
	const { t } = createI18n('en');
</script>

<svelte:head><title>{data.studioName || t('client.home.title')}</title></svelte:head>

<main class="home">
	{#if data.studioName}<p class="label studio">{data.studioName}</p>{/if}
	<h1>{t('client.home.title')}</h1>
	<p class="text">{t('client.home.text')}</p>
</main>

<style>
	.home {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		padding: var(--space-6) var(--space-5);
		text-align: center;
	}

	.studio {
		margin: 0;
		color: var(--color-text-muted);
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: var(--display-weight);
		letter-spacing: var(--display-tracking);
		text-transform: var(--display-case);
		font-size: clamp(1.75rem, 4vw, 2.75rem);
	}

	.text {
		margin: 0;
		max-width: 36ch;
		color: var(--color-text-muted);
	}
</style>
