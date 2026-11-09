<script lang="ts">
	import { page } from '$app/state';
	import { createI18n, provideI18n } from '$lib/i18n';
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
			visitor: { email: null, favorites: [], lists: [], activeListId: null },
			t
		})
	);
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
			placeholder={null}
			color={null}
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

	.empty {
		padding: var(--space-8) 0;
		text-align: center;
		color: var(--color-text-muted);
	}
</style>
