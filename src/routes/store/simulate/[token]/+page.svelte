<script lang="ts">
	import { createI18n } from '$lib/i18n';
	import { formatMoney } from '$lib/store';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { t } = createI18n(data.language);
</script>

<svelte:head><title>{t('store.sim.title')}</title><meta name="robots" content="noindex" /></svelte:head>

<main class="sim">
	<p class="label badge">{t('store.sim.badge')}</p>
	<h1>{data.storeName || t('store.sim.title')}</h1>
	<p>{data.number > 0 ? t('store.orderNumber', { number: String(data.number) }) : t('store.yourOrder')} · {data.email}</p>
	<p class="total">{formatMoney(data.total, data.currency, data.language)}</p>
	<p class="hint">{t('store.sim.hint')}</p>
	{#if data.status === 'unpaid'}
		<div class="row">
			<form method="POST" action="?/pay"><button class="c-btn solid" type="submit">{t('store.sim.pay')}</button></form>
			<form method="POST" action="?/cancel"><button class="c-btn" type="submit">{t('common.cancel')}</button></form>
		</div>
	{:else}
		<a class="c-btn" href="/">{t('common.back')}</a>
	{/if}
</main>

<style>
	.sim {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		max-width: 480px;
		margin: 0 auto;
		padding: var(--space-9) var(--space-5);
		text-align: center;
	}

	.badge {
		padding: 4px 10px;
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
	}

	.total {
		margin: var(--space-3) 0;
		font-size: 2rem;
		font-variant-numeric: tabular-nums;
	}

	.hint {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.row {
		display: flex;
		gap: var(--space-3);
	}
</style>
