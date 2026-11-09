<script lang="ts">
	import { page } from '$app/state';
	import { createI18n, provideI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import Banner from '$lib/components/client/Banner.svelte';
	import Cover from '$lib/components/client/Cover.svelte';
	import DownloadDialog from '$lib/components/client/DownloadDialog.svelte';
	import EmailDialog from '$lib/components/client/EmailDialog.svelte';
	import ExpiredPage from '$lib/components/client/ExpiredPage.svelte';
	import GalleryAssist from '$lib/components/client/GalleryAssist.svelte';
	import GalleryHeader from '$lib/components/client/GalleryHeader.svelte';
	import OwnerBar from '$lib/components/client/OwnerBar.svelte';
	import PasswordGate from '$lib/components/client/PasswordGate.svelte';
	import RegisterGate from '$lib/components/client/RegisterGate.svelte';
	import { GalleryState, setGalleryState } from '$lib/components/client/gallery-state.svelte';

	let { data, children } = $props();

	// svelte-ignore state_referenced_locally
	const i18n = createI18n(data.gallery.language);
	provideI18n(i18n);
	const { t } = i18n;

	// svelte-ignore state_referenced_locally
	const gallery = setGalleryState(new GalleryState(data.gallery.slug, data.visitor.email, data.visitor.favorites));

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
	{:else if data.state === 'locked'}
		<PasswordGate
			slug={data.gallery.slug}
			name={data.gallery.name}
			placeholder={data.lockedCover?.placeholder ?? null}
			color={data.lockedCover?.color ?? null}
			error={page.url.searchParams.get('error') === 'tooMany' ? 'tooMany' : page.url.searchParams.get('error') ? 'wrong' : null}
			redirectTo={page.url.pathname}
		/>
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

	.notice {
		margin: 0 0 var(--space-4);
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
