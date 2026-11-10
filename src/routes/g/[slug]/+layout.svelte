<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { createI18n, provideI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import Banner from '$lib/components/client/Banner.svelte';
	import Cover from '$lib/components/client/Cover.svelte';
	import DownloadDialog from '$lib/components/client/DownloadDialog.svelte';
	import EmailDialog from '$lib/components/client/EmailDialog.svelte';
	import ClientLoginDialog from '$lib/components/client/ClientLoginDialog.svelte';
	import BuyDialog from '$lib/components/client/BuyDialog.svelte';
	import ListPicker from '$lib/components/client/ListPicker.svelte';
	import ExpiredPage from '$lib/components/client/ExpiredPage.svelte';
	import GalleryAssist from '$lib/components/client/GalleryAssist.svelte';
	import GalleryHeader from '$lib/components/client/GalleryHeader.svelte';
	import OwnerBar from '$lib/components/client/OwnerBar.svelte';
	import PasswordGate from '$lib/components/client/PasswordGate.svelte';
	import AccessGate from '$lib/components/client/AccessGate.svelte';
	import RegisterGate from '$lib/components/client/RegisterGate.svelte';
	import { GalleryState, setGalleryState } from '$lib/components/client/gallery-state.svelte';

	let { data, children } = $props();

	// svelte-ignore state_referenced_locally
	const i18n = createI18n(data.gallery.language);
	provideI18n(i18n);
	const { t } = i18n;

	// svelte-ignore state_referenced_locally
	const gallery = setGalleryState(
		new GalleryState({ slug: data.gallery.slug, share: data.shared?.token, visitor: data.visitor, canMarkPrivate: data.gallery.canMarkPrivate, t })
	);
	// Keep the state in step with the server after logins and navigation.
	$effect(() => {
		gallery.apply(data.visitor);
		gallery.canMarkPrivate = data.gallery.canMarkPrivate;
		gallery.canBuy = Boolean(data.store?.products.some((p) => !p.noPhoto && !(p.kind === 'digital' && p.digital?.scope === 'gallery')));
		gallery.cartCount = data.store?.cartCount ?? 0;
	});
	let clientDialog = $state(false);

	async function backToSelection() {
		await fetch(`/g/${data.gallery.slug}/api/access`, { method: 'DELETE' }).catch(() => null);
		await invalidateAll();
	}

	async function clientLogout() {
		await fetch(`/g/${data.gallery.slug}/api/client`, { method: 'DELETE' }).catch(() => null);
		gallery.stopSelecting();
		await invalidateAll();
		toast(t('client.clientLogin.loggedOut'));
	}

	const isLanding = $derived(page.route.id === '/g/[slug]');
	const activeSlug = $derived(
		page.route.id === '/g/[slug]/s/[section]'
			? (page.params.section ?? null)
			: isLanding
				? (data.sections[0]?.slug ?? null)
				: null
	);
	const activeSection = $derived(data.sections.find((s) => s.slug === activeSlug) ?? null);
	const options = $derived(data.gallery.options);
	const download = $derived(data.gallery.download);
	const canDownloadSomething = $derived(
		download.enabled && (download.highRes || download.web) && (!download.sections || download.sections.length > 0)
	);

	function scrollToGallery() {
		document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
	}

	async function share() {
		const url = `${location.origin}/g/${data.gallery.slug}`;
		if (navigator.share && matchMedia('(pointer: coarse)').matches) {
			try {
				await navigator.share({ title: data.gallery.name, url });
				return;
			} catch (err) {
				if ((err as Error).name === 'AbortError') return;
			}
		}
		await navigator.clipboard.writeText(url);
		toast(t('client.linkCopied'));
	}
</script>

<svelte:head>
	<title>{data.gallery.name}{data.studio.name ? ` · ${data.studio.name}` : ''}</title>
	<meta name="theme-color" content={data.gallery.design.theme === 'dark' || data.gallery.design.theme === 'black' ? '#121212' : '#ffffff'} />
</svelte:head>

<div class="gallery-root" data-theme={data.gallery.design.theme} data-fonts={data.gallery.design.fonts}>
	{#if data.state === 'expired'}
		<ExpiredPage
			name={data.gallery.name}
			studio={data.studio}
			placeholder={data.lockedCover?.placeholder ?? null}
			color={data.lockedCover?.color ?? null}
		/>
	{:else if data.state === 'choose'}
		<AccessGate slug={data.gallery.slug} name={data.gallery.name} subtitle={data.studio.name || null} cover={data.gateCover} />
	{:else if data.state === 'locked'}
		<PasswordGate
			slug={data.gallery.slug}
			name={data.gallery.name}
			subtitle={data.studio.name || null}
			cover={data.gateCover}
			error={page.url.searchParams.get('error') === 'tooMany' ? 'tooMany' : page.url.searchParams.get('error') ? 'wrong' : null}
			redirectTo={page.url.pathname}
			onback={data.gallery.clientLogin ? backToSelection : null}
		/>
	{:else if data.state === 'shop' && data.shared}
		<!-- The cart for someone a favorite list was shared with: no way into the rest of the gallery. -->
		<header class="shop-bar">
			<a class="back" href="/l/{data.shared.token}">
				<ArrowLeft size={18} strokeWidth={1.5} />
				<span>{t('client.share.backToList', { name: data.shared.name || t('client.lists.default') })}</span>
			</a>
			<span class="label shop-name">{data.gallery.name}</span>
		</header>
		<main class="content">
			{@render children()}
		</main>
	{:else if data.state === 'register'}
		<RegisterGate
			slug={data.gallery.slug}
			name={data.gallery.name}
			placeholder={data.lockedCover?.placeholder ?? null}
			color={data.lockedCover?.color ?? null}
		/>
	{:else}
		{#if data.isAdmin && !data.isPreview}
			<OwnerBar galleryId={data.gallery.id} status={data.gallery.status} />
		{/if}
		{#if data.banner}
			<Banner galleryId={data.gallery.id} text={data.banner.text} code={data.banner.code} />
		{/if}

		{#if isLanding}
			<Cover
				name={data.gallery.name}
				eventDate={data.gallery.eventDate}
				studioName={data.studio.name}
				coverLogo={data.studio.coverLogo}
				layout={data.gallery.design.cover}
				cover={data.cover}
				focalX={data.gallery.coverFocalX}
				focalY={data.gallery.coverFocalY}
				onview={scrollToGallery}
			/>
		{/if}

		<div id="gallery">
			<GalleryHeader
				slug={data.gallery.slug}
				name={data.gallery.name}
				studioName={data.studio.name}
				sections={data.sections}
				{activeSlug}
				favoritesActive={page.route.id === '/g/[slug]/favorites'}
				favoritesCount={gallery.favorites.size}
				showFavorites={data.gallery.favoritesEnabled}
				showDownload={canDownloadSomething}
				showSlideshow={options.slideshow && data.totalPhotos > 0}
				navStyle={data.gallery.design.navStyle}
				ondownload={() => (gallery.download = { scope: 'all', sectionId: activeSection?.id })}
				onshare={share}
				onslideshow={() => (gallery.slideshowRequests += 1)}
				clientLogin={data.gallery.clientLogin && !data.isAdmin}
				isClient={data.gallery.role === 'client'}
				canSelect={data.gallery.canMarkPrivate && page.route.id !== '/g/[slug]/favorites'}
				onclientlogin={() => (clientDialog = true)}
				onclientlogout={clientLogout}
				onselect={() => (gallery.selecting = true)}
				showStore={Boolean(data.store)}
				cartCount={gallery.cartCount}
				storeActive={page.route.id === '/g/[slug]/store'}
			/>
			<main class="content">
				{#if data.pending > 0}
					<p class="notice">{t('client.processing')}</p>
				{/if}
				{@render children()}
			</main>
		</div>

		{#if gallery.download}
			<DownloadDialog settings={data.gallery.download} sectionCount={data.sections.length} />
		{/if}
		{#if gallery.emailPrompt}
			<EmailDialog />
		{/if}
		{#if gallery.picking}
			<ListPicker />
		{/if}
		{#if gallery.buy && data.store}
			<BuyDialog products={data.store.products} currency={data.store.currency} />
		{/if}
		{#if clientDialog}
			<ClientLoginDialog slug={data.gallery.slug} onclose={() => (clientDialog = false)} />
		{/if}
		{#if options.galleryAssist && !data.isPreview}
			<GalleryAssist galleryId={data.gallery.id} favorites={data.gallery.favoritesEnabled} downloads={canDownloadSomething} />
		{/if}
	{/if}
</div>

<style>
	.gallery-root {
		min-height: 100svh;
		background: var(--color-bg);
		color: var(--color-text);
		font-family: var(--font-body);
	}

	.content {
		padding: 0 clamp(var(--space-4), 3vw, var(--space-7)) var(--space-8);
		min-height: 60vh;
	}

	.shop-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: 64px;
		padding: var(--space-3) clamp(var(--space-4), 3vw, var(--space-7));
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		min-width: 0;
		color: var(--color-text);
		text-decoration: none;
	}

	.back span,
	.shop-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.shop-name {
		color: var(--color-text-muted);
	}

	.notice {
		margin: 0 0 var(--space-4);
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
