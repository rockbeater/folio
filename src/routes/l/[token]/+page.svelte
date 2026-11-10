<script lang="ts">
	import { page } from '$app/state';
	import { createI18n, provideI18n } from '$lib/i18n';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import BuyDialog from '$lib/components/client/BuyDialog.svelte';
	import DownloadDialog from '$lib/components/client/DownloadDialog.svelte';
	import EmailDialog from '$lib/components/client/EmailDialog.svelte';
	import GalleryView from '$lib/components/client/GalleryView.svelte';
	import PasswordGate from '$lib/components/client/PasswordGate.svelte';
	import ShareHeader from '$lib/components/client/ShareHeader.svelte';
	import { GalleryState, setGalleryState } from '$lib/components/client/gallery-state.svelte';
	import { canDownloadPhoto } from '$lib/types';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const i18n = createI18n(data.gallery.language);
	provideI18n(i18n);
	const { t } = i18n;
	// svelte-ignore state_referenced_locally
	const gs = setGalleryState(
		new GalleryState({
			slug: data.gallery.slug,
			share: data.token,
			visitor: { email: null, favorites: [], memberships: {}, lists: [], activeListId: null },
			t
		})
	);
	$effect(() => {
		gs.canBuy = Boolean(data.store?.products.some((p) => !p.noPhoto && !(p.kind === 'digital' && p.digital?.scope === 'gallery')));
		gs.cartCount = data.store?.cartCount ?? 0;
	});
	const cartHref = $derived(data.store ? `/g/${data.gallery.slug}/cart?share=${encodeURIComponent(data.token)}` : null);
	const download = $derived(data.gallery.download);
	const title = $derived(data.listName || t('client.lists.default'));
</script>

<svelte:head>
	<title>{title}{data.studio.name ? ` · ${data.studio.name}` : ''}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="share-root" data-theme={data.gallery.design.theme} data-fonts={data.gallery.design.fonts}>
	{#if data.locked}
		<PasswordGate
			slug={data.gallery.slug}
			name={data.gallery.name}
			subtitle={data.studio.name || null}
			error={page.url.searchParams.get('error') === 'tooMany' ? 'tooMany' : page.url.searchParams.get('error') ? 'wrong' : null}
			redirectTo={page.url.pathname}
		/>
	{:else}
		<ShareHeader
			{title}
			subtitle={data.open ? data.gallery.name : null}
			studio={data.studio}
			count={data.photos.length}
			galleryHref={data.open ? `/g/${data.gallery.slug}` : null}
			canDownload={download.enabled && (download.highRes || download.web) && data.photos.length > 0}
			ondownload={() => (gs.download = { scope: 'all' })}
			{cartHref}
			cartCount={gs.cartCount}
		/>
		<main class="content">
			{#if data.photos.length === 0}
				<p class="empty">{t('client.share.empty')}</p>
			{:else}
				<GalleryView
					photos={data.photos}
					design={data.gallery.design}
					options={data.gallery.options}
					canFavorite={false}
					canDownload={canDownloadPhoto(download, null)}
					sectionId={null}
				/>
			{/if}
		</main>
		{#if gs.download}
			<DownloadDialog settings={download} sectionCount={1} />
		{/if}
		{#if gs.emailPrompt}
			<EmailDialog />
		{/if}
		{#if gs.buy && data.store}
			<BuyDialog products={data.store.products} currency={data.store.currency} />
		{/if}
		{#if cartHref && gs.cartCount > 0}
			<!-- Always in reach once something is in the cart, wherever the visitor has scrolled to. -->
			<a class="cart-fab c-btn solid" href={cartHref}>
				<ShoppingBag size={18} strokeWidth={1.5} />{t('store.cart')} <span class="tabular">({gs.cartCount})</span>
			</a>
		{/if}
	{/if}
</div>

<style>
	.share-root {
		min-height: 100svh;
		background: var(--color-bg);
		color: var(--color-text);
		font-family: var(--font-body);
	}

	.content {
		padding: 0 clamp(var(--space-4), 3vw, var(--space-7)) var(--space-8);
	}

	.cart-fab {
		position: fixed;
		right: var(--space-4);
		bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
		z-index: 40;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
	}

	.empty {
		padding: var(--space-8) 0;
		text-align: center;
		color: var(--color-text-muted);
	}
</style>
