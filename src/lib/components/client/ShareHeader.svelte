<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import { useI18n } from '$lib/i18n';

	interface Props {
		title: string;
		subtitle: string | null;
		studio: { name: string; logo: string | null };
		count: number;
		/** Open shares link on to the gallery. */
		galleryHref: string | null;
		canDownload: boolean;
		ondownload: () => void;
		/** The gallery's cart, when its store is on. */
		cartHref?: string | null;
		cartCount?: number;
	}

	let { title, subtitle, studio, count, galleryHref, canDownload, ondownload, cartHref = null, cartCount = 0 }: Props = $props();
	const { t, plural } = useI18n();
</script>

<header class="head">
	<div class="studio">
		{#if studio.logo}<img class="logo" src={studio.logo} alt={studio.name} />{:else if studio.name}<span class="label">{studio.name}</span>{/if}
	</div>
	<h1>{title}</h1>
	<p class="meta label">
		{#if subtitle}{subtitle} · {/if}{plural('common.photos', count)}
	</p>
	<div class="actions">
		{#if canDownload}
			<button class="c-btn" type="button" onclick={ondownload}><Download size={16} strokeWidth={1.5} />{t('client.download')}</button>
		{/if}
		{#if cartHref}
			<a class="c-btn" href={cartHref}>
				<ShoppingBag size={16} strokeWidth={1.5} />{t('store.cart')}{#if cartCount > 0}<span class="count tabular">{cartCount}</span>{/if}
			</a>
		{/if}
		{#if galleryHref}
			<a class="c-btn" href={galleryHref}>{t('client.share.viewGallery')}</a>
		{/if}
	</div>
</header>

<style>
	.head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-8) var(--space-4) var(--space-7);
		text-align: center;
	}

	.logo {
		max-height: 48px;
		width: auto;
	}

	h1 {
		margin: var(--space-3) 0 0;
		font-family: var(--font-display);
		font-weight: var(--display-weight);
		letter-spacing: var(--display-tracking);
		text-transform: var(--display-case);
		font-size: clamp(1.75rem, 4vw, 2.75rem);
		line-height: 1.15;
	}

	.meta {
		margin: 0;
		color: var(--color-text-muted);
	}

	.count {
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--color-accent);
		color: var(--color-bg);
		font-size: 0.6875rem;
		line-height: 18px;
		letter-spacing: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
