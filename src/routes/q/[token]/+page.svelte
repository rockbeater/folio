<script lang="ts">
	import { page } from '$app/state';
	import { createI18n, provideI18n } from '$lib/i18n';
	import DownloadDialog from '$lib/components/client/DownloadDialog.svelte';
	import ExpiredPage from '$lib/components/client/ExpiredPage.svelte';
	import GalleryView from '$lib/components/client/GalleryView.svelte';
	import PasswordGate from '$lib/components/client/PasswordGate.svelte';
	import ShareHeader from '$lib/components/client/ShareHeader.svelte';
	import { GalleryState, setGalleryState } from '$lib/components/client/gallery-state.svelte';

	let { data, form } = $props();
	// svelte-ignore state_referenced_locally
	const i18n = createI18n(data.gallery.language);
	provideI18n(i18n);
	// svelte-ignore state_referenced_locally
	const gs = setGalleryState(
		new GalleryState({ slug: data.gallery.slug, visitor: { email: null, favorites: [], memberships: {}, lists: [], activeListId: null }, t: i18n.t })
	);
	const download = $derived(data.download);
</script>

<svelte:head>
	<title>{data.name}{data.studio.name ? ` · ${data.studio.name}` : ''}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="share-root" data-theme={data.gallery.design.theme} data-fonts={data.gallery.design.fonts}>
	{#if data.state === 'expired'}
		<ExpiredPage name={data.name} studio={data.studio} placeholder={null} color={null} />
	{:else if data.state === 'locked'}
		<PasswordGate
			slug={data.gallery.slug}
			name={data.name}
			subtitle={data.studio.name || null}
			error={form?.error ?? null}
			redirectTo={page.url.pathname}
			action={page.url.pathname}
		/>
	{:else if download}
		<ShareHeader
			title={data.name}
			subtitle={null}
			studio={data.studio}
			count={data.photos.length}
			galleryHref={null}
			canDownload={download.enabled && (download.highRes || download.web) && data.photos.length > 0}
			ondownload={() => (gs.download = { scope: 'all' })}
		/>
		<main class="content">
			<GalleryView
				photos={data.photos}
				design={data.gallery.design}
				options={data.gallery.options}
				canFavorite={false}
				canDownload={download.enabled && (download.highRes || download.web)}
				sectionId={null}
			/>
		</main>
		{#if gs.download}
			<DownloadDialog settings={download} sectionCount={1} endpoint="{page.url.pathname}/download" />
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
</style>
