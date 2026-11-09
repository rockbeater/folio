<script lang="ts">
	import GalleryView from '$lib/components/client/GalleryView.svelte';
	import { getGalleryState } from '$lib/components/client/gallery-state.svelte';
	import { useI18n } from '$lib/i18n';
	import { canDownloadPhoto } from '$lib/types';

	let { data } = $props();
	const { t } = useI18n();
	const gallery = getGalleryState();

	// Keep showing photos that were un-favorited on this page until it is reloaded,
	// so the grid does not jump; but add newly loaded ones.
	const photos = $derived(data.photos);
</script>

{#if data.state === 'open'}
	<h1 class="title label">{t('client.favoritesTitle')}</h1>
	{#if gallery.favorites.size === 0 && photos.length === 0}
		<p class="empty">{t('client.favoritesEmpty')}</p>
	{:else}
		<GalleryView
			{photos}
			design={data.gallery.design}
			options={data.gallery.options}
			canFavorite={data.gallery.favoritesEnabled}
			canDownload={canDownloadPhoto(data.gallery.download, null)}
			sectionId={null}
		/>
	{/if}
{/if}

<style>
	.title {
		margin: var(--space-3) 0 var(--space-5);
		color: var(--color-text-muted);
	}

	.empty {
		padding: var(--space-8) 0;
		text-align: center;
		color: var(--color-text-muted);
	}
</style>
