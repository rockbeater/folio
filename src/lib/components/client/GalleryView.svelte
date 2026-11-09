<script lang="ts">
	import { page } from '$app/state';
	import { pushState, replaceState } from '$app/navigation';
	import PhotoGrid from './PhotoGrid.svelte';
	import Lightbox from './Lightbox.svelte';
	import { getGalleryState } from './gallery-state.svelte';
	import { useI18n } from '$lib/i18n';
	import type { GalleryDesign, GalleryOptions, PhotoView } from '$lib/types';

	interface Props {
		photos: PhotoView[];
		design: GalleryDesign;
		options: GalleryOptions;
		canFavorite: boolean;
		/** Single photos can be downloaded. */
		canDownload: boolean;
		sectionId: string | null;
	}

	let { photos, design, options, canFavorite, canDownload, sectionId }: Props = $props();
	const gs = getGalleryState();
	const { t } = useI18n();

	function toggleSelect(id: string) {
		if (gs.selection.has(id)) gs.selection.delete(id);
		else gs.selection.add(id);
	}

	function buy(photoId: string) {
		gs.buy = { photo: photos.find((p) => p.id === photoId) ?? null, photos };
	}

	async function markSelected(value: boolean) {
		if (await gs.setPrivate([...gs.selection], value)) gs.stopSelecting();
	}

	// The open photo lives in the history state, so the back button closes the lightbox.
	const openIndex = $derived.by(() => {
		const id = page.state.photo;
		return id ? photos.findIndex((p) => p.id === id) : -1;
	});

	function open(index: number, slideshow = false) {
		pushState('', { photo: photos[index].id, slideshow });
	}

	function change(index: number) {
		replaceState('', { photo: photos[index].id, slideshow: page.state.slideshow });
	}

	function close() {
		history.back();
	}

	function download(photoId: string) {
		gs.download = { scope: 'photo', photoId, sectionId: sectionId ?? undefined };
	}

	// The header's slideshow button starts from the first photo of this page.
	let handled = gs.slideshowRequests;
	$effect(() => {
		if (gs.slideshowRequests !== handled) {
			handled = gs.slideshowRequests;
			if (photos.length > 0) open(0, true);
		}
	});
</script>

<PhotoGrid
	{photos}
	gridStyle={design.gridStyle}
	size={design.thumbSize}
	spacing={design.gridSpacing}
	favorites={gs.favorites}
	showFilenames={options.showFilenames}
	{canFavorite}
	{canDownload}
	onopen={(index) => open(index)}
	onfavorite={(id) => gs.toggleFavorite(id)}
	ondownload={download}
	isPrivate={(p) => gs.isPrivate(p)}
	selection={gs.selecting ? gs.selection : null}
	onselect={toggleSelect}
	canBuy={gs.canBuy}
	onbuy={buy}
	canMarkPrivate={gs.canMarkPrivate}
	onprivate={(id, value) => gs.setPrivate([id], value)}
/>

{#if gs.selecting}
	<div class="select-bar" role="region" aria-label={t('client.select.title')}>
		<span>{t('client.select.count', { count: gs.selection.size })}</span>
		<div class="row">
			<button class="c-btn small" type="button" disabled={gs.selection.size === 0} onclick={() => markSelected(true)}>
				{t('client.private.mark')}
			</button>
			<button class="c-btn small" type="button" disabled={gs.selection.size === 0} onclick={() => markSelected(false)}>
				{t('client.private.unmark')}
			</button>
			<button class="c-btn small ghost" type="button" onclick={() => gs.stopSelecting()}>{t('common.cancel')}</button>
		</div>
	</div>
{/if}

{#if openIndex >= 0}
	<Lightbox
		{photos}
		index={openIndex}
		favorites={gs.favorites}
		{canFavorite}
		{canDownload}
		canSlideshow={options.slideshow}
		autoplay={Boolean(page.state.slideshow)}
		showFilenames={options.showFilenames}
		onchange={change}
		onclose={close}
		onfavorite={(id) => gs.toggleFavorite(id)}
		ondownload={download}
		canMarkPrivate={gs.canMarkPrivate}
		isPrivate={(p) => gs.isPrivate(p)}
		onprivate={(id, value) => gs.setPrivate([id], value)}
		canBuy={gs.canBuy}
		onbuy={buy}
	/>
{/if}

<style>
	.select-bar {
		position: fixed;
		left: 50%;
		bottom: var(--space-5);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		transform: translateX(-50%);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
		white-space: nowrap;
	}

	.row {
		display: flex;
		gap: var(--space-2);
	}

	@media (max-width: 640px) {
		.select-bar {
			left: var(--space-3);
			right: var(--space-3);
			bottom: var(--space-3);
			transform: none;
			flex-wrap: wrap;
			justify-content: center;
			border-radius: 16px;
		}
	}
</style>
