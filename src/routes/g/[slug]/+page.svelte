<script lang="ts">
	import GalleryView from '$lib/components/client/GalleryView.svelte';
	import { useI18n } from '$lib/i18n';

	let { data } = $props();
	const { t } = useI18n();
</script>

{#if !data.locked}
	{#if data.photos.length > 0}
		<GalleryView
			photos={data.photos}
			design={data.gallery.design}
			canFavorite={data.gallery.favoritesEnabled}
			canDownload={data.gallery.download.enabled}
			sectionId={data.sectionId}
		/>
	{:else}
		<p class="empty">{t('client.emptySection')}</p>
	{/if}
{/if}

<style>
	.empty {
		padding: var(--space-8) 0;
		text-align: center;
		color: var(--color-text-muted);
	}
</style>
