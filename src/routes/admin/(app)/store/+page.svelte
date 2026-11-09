<script lang="ts">
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
</script>

<svelte:head><title>{t('admin.store.title')} · Folio</title></svelte:head>

<main class="page">
	<h1>{t('admin.store.title')}</h1>
	<div class="card empty">
		<ShoppingBag size={28} strokeWidth={1.5} />
		<p>{t('admin.store.soon')}</p>
	</div>
</main>

<style>
	.page {
		max-width: 820px;
		margin: 0 auto;
		padding: 28px 20px 64px;
	}

	h1 {
		font-size: 1.5rem;
		margin-bottom: 20px;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 56px 24px;
		color: var(--muted);
		text-align: center;
	}

	.empty p {
		margin: 0;
		max-width: 48ch;
	}
</style>
