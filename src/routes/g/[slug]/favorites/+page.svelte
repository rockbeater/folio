<script lang="ts">
	import GalleryView from '$lib/components/client/GalleryView.svelte';
	import ListBar from '$lib/components/client/ListBar.svelte';
	import { getGalleryState } from '$lib/components/client/gallery-state.svelte';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { canDownloadPhoto, displayUrl } from '$lib/types';

	let { data } = $props();
	const { t } = useI18n();
	const gallery = getGalleryState();

	const photos = $derived(data.photos);
	const download = $derived(data.gallery.download);
	let mode = $state<'grid' | 'notes'>('grid');
	// svelte-ignore state_referenced_locally
	let notes = $state<Record<string, string>>({ ...data.notes });
	$effect(() => {
		notes = { ...data.notes };
	});

	async function saveNote(photoId: string) {
		const ok = await gallery.listAction({ action: 'note', listId: gallery.activeListId, photoId, note: notes[photoId] ?? '' });
		if (ok) toast(t('client.notes.saved'));
	}
</script>

{#if data.state === 'open'}
	<h1 class="title label">{t('client.favoritesTitle')}</h1>
	{#if gallery.email}
		<ListBar
			canShare={data.gallery.listSharing}
			privateDefault={data.gallery.privateShareDefault}
			canDownload={download.enabled && (download.highRes || download.web)}
		/>
	{/if}
	{#if photos.length === 0}
		<p class="empty">{t('client.favoritesEmpty')}</p>
	{:else}
		<div class="modes" role="tablist">
			<button type="button" role="tab" aria-selected={mode === 'grid'} onclick={() => (mode = 'grid')}>{t('client.notes.photos')}</button>
			<button type="button" role="tab" aria-selected={mode === 'notes'} onclick={() => (mode = 'notes')}>{t('client.notes.title')}</button>
		</div>
		{#if mode === 'grid'}
			<GalleryView
				{photos}
				design={data.gallery.design}
				options={data.gallery.options}
				canFavorite={data.gallery.favoritesEnabled}
				canDownload={canDownloadPhoto(download, null)}
				sectionId={null}
			/>
		{:else}
			<ul class="notes">
				{#each photos as photo (photo.id)}
					<li>
						<img src={displayUrl(photo, 480)} alt="" loading="lazy" style:background-color={photo.color} />
						<div class="note">
							<span class="filename">{photo.filename}</span>
							<textarea
								class="c-input"
								rows="2"
								maxlength="500"
								placeholder={t('client.notes.placeholder')}
								bind:value={notes[photo.id]}
								onblur={() => (notes[photo.id] ?? '') !== (data.notes[photo.id] ?? '') && saveNote(photo.id)}
								aria-label={t('client.notes.label', { name: photo.filename })}
							></textarea>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
{/if}

<style>
	.title {
		margin: var(--space-3) 0 0;
		color: var(--color-text-muted);
	}

	.empty {
		padding: var(--space-8) 0;
		text-align: center;
		color: var(--color-text-muted);
	}

	.modes {
		display: flex;
		gap: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.modes button {
		padding: var(--space-2) 0;
		border: 0;
		border-bottom: 1px solid transparent;
		background: none;
		color: var(--color-text-muted);
		font-family: var(--font-label);
		font-size: 0.75rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.modes button[aria-selected='true'] {
		border-bottom-color: var(--color-text);
		color: var(--color-text);
	}

	.notes {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
		max-width: 820px;
	}

	.notes li {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: var(--space-4);
		align-items: start;
	}

	.notes img {
		width: 120px;
		height: 90px;
		object-fit: cover;
	}

	.note {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.filename {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}
</style>
