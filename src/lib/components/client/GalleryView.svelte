<script lang="ts">
	import { page } from '$app/state';
	import { pushState, replaceState } from '$app/navigation';
	import PhotoGrid from './PhotoGrid.svelte';
	import Lightbox from './Lightbox.svelte';
	import { getGalleryState } from './gallery-state.svelte';
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
/>

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
	/>
{/if}
