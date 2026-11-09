<script lang="ts">
	import { page } from '$app/state';
	import { pushState, replaceState } from '$app/navigation';
	import PhotoGrid from './PhotoGrid.svelte';
	import Lightbox from './Lightbox.svelte';
	import { getGalleryState } from './gallery-state.svelte';
	import type { GalleryDesign, PhotoView } from '$lib/types';

	interface Props {
		photos: PhotoView[];
		design: GalleryDesign;
		canFavorite: boolean;
		canDownload: boolean;
		sectionId: string | null;
	}

	let { photos, design, canFavorite, canDownload, sectionId }: Props = $props();
	const gs = getGalleryState();

	// The open photo lives in the history state, so the back button closes the lightbox.
	const openIndex = $derived.by(() => {
		const id = page.state.photo;
		return id ? photos.findIndex((p) => p.id === id) : -1;
	});

	function open(index: number) {
		pushState('', { photo: photos[index].id });
	}

	function change(index: number) {
		replaceState('', { photo: photos[index].id });
	}

	function close() {
		history.back();
	}

	function download(photoId: string) {
		gs.download = { scope: 'photo', photoId, sectionId: sectionId ?? undefined };
	}
</script>

<PhotoGrid
	{photos}
	gridStyle={design.gridStyle}
	size={design.thumbSize}
	spacing={design.gridSpacing}
	favorites={gs.favorites}
	{canFavorite}
	{canDownload}
	onopen={open}
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
		onchange={change}
		onclose={close}
		onfavorite={(id) => gs.toggleFavorite(id)}
		ondownload={download}
	/>
{/if}
