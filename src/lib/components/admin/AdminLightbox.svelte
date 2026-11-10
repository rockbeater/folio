<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Download from '@lucide/svelte/icons/download';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Star from '@lucide/svelte/icons/star';
	import X from '@lucide/svelte/icons/x';
	import { useI18n } from '$lib/i18n';
	import { displaySrcset, displayUrl } from '$lib/types';
	import type { AdminPhoto } from './editor-types';

	interface Props {
		/** The photos to page through (ready ones), in grid order. */
		photos: AdminPhoto[];
		index: number;
		galleryId: string;
		coverPhotoId: string | null;
		onclose: () => void;
		oncover: (id: string) => void;
		onhide: (id: string, hidden: boolean) => void;
	}

	let { photos, index = $bindable(), galleryId, coverPhotoId, onclose, oncover, onhide }: Props = $props();
	const { t } = useI18n();

	const at = $derived(Math.min(Math.max(0, index), photos.length - 1));
	const photo = $derived(photos[at]);

	function go(step: number) {
		if (photos.length > 1) index = (at + step + photos.length) % photos.length;
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
		else if (event.key === 'ArrowLeft') go(-1);
		else if (event.key === 'ArrowRight') go(1);
	}

	// Load the neighbours, so paging feels instant.
	$effect(() => {
		for (const step of [-1, 1]) {
			const next = photos[(at + step + photos.length) % photos.length];
			if (next && next !== photo) new Image().src = displayUrl(next, 1600);
		}
	});

	onMount(() => {
		const overflow = document.documentElement.style.overflow;
		document.documentElement.style.overflow = 'hidden';
		return () => {
			document.documentElement.style.overflow = overflow;
		};
	});

	$effect(() => {
		if (photos.length === 0) onclose();
	});
</script>

<svelte:window onkeydown={onKey} />

{#if photo}
	<div class="lightbox" role="dialog" aria-modal="true" aria-label={photo.filename}>
		<header class="bar">
			<div class="title">
				<strong>{photo.filename}</strong>
				<span class="muted tabular">{at + 1} / {photos.length}</span>
				{#if coverPhotoId === photo.id}<span class="tag">{t('admin.editor.isCover')}</span>{/if}
				{#if photo.hidden}<span class="tag">{t('admin.bulk.hidden')}</span>{/if}
			</div>
			<div class="actions">
				{#if coverPhotoId !== photo.id}
					<button class="tool" type="button" onclick={() => oncover(photo.id)} title={t('admin.editor.setCover')} aria-label={t('admin.editor.setCover')}><Star size={18} /></button>
				{/if}
				<button
					class="tool"
					type="button"
					onclick={() => onhide(photo.id, !photo.hidden)}
					title={photo.hidden ? t('admin.bulk.show') : t('admin.bulk.hide')}
					aria-label={photo.hidden ? t('admin.bulk.show') : t('admin.bulk.hide')}
				>
					{#if photo.hidden}<Eye size={18} />{:else}<EyeOff size={18} />{/if}
				</button>
				<a
					class="tool"
					href="/admin/api/galleries/{galleryId}/download?ids={photo.id}"
					download
					title={t('admin.lists.downloadOriginal')}
					aria-label={t('admin.lists.downloadOriginal')}><Download size={18} /></a
				>
				<button class="tool" type="button" onclick={onclose} title={t('common.close')} aria-label={t('common.close')}><X size={20} /></button>
			</div>
		</header>

		<div class="stage">
			{#key photo.id}
				<img
					src={displayUrl(photo, 1600)}
					srcset={displaySrcset(photo)}
					sizes="100vw"
					alt={photo.filename}
					class:dimmed={photo.hidden}
					style:background-color={photo.color}
				/>
			{/key}
			{#if photos.length > 1}
				<button class="nav prev" type="button" onclick={() => go(-1)} aria-label={t('admin.lightbox.prev')}><ChevronLeft size={28} /></button>
				<button class="nav next" type="button" onclick={() => go(1)} aria-label={t('admin.lightbox.next')}><ChevronRight size={28} /></button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		background: rgba(12, 12, 12, 0.96);
		color: #f2f2f2;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		min-height: 56px;
		padding: 8px 12px 8px 20px;
	}

	.title {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.title strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.muted {
		color: #9a9a9a;
		font-size: 0.875rem;
	}

	.tag {
		padding: 2px 8px;
		border: 1px solid #555;
		border-radius: 999px;
		color: #cfcfcf;
		font-size: 0.6875rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		flex-shrink: 0;
		gap: 4px;
	}

	.tool {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background: none;
		color: inherit;
		cursor: pointer;
	}

	.tool:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.stage {
		position: relative;
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		min-height: 0;
		padding: 8px 72px 24px;
	}

	.stage img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.stage img.dimmed {
		opacity: 0.5;
	}

	.nav {
		position: absolute;
		top: 50%;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
		color: inherit;
		cursor: pointer;
		transform: translateY(-50%);
	}

	.nav:hover {
		background: rgba(255, 255, 255, 0.16);
	}

	.prev {
		left: 12px;
	}

	.next {
		right: 12px;
	}

	@media (max-width: 640px) {
		.stage {
			padding: 8px 8px 72px;
		}

		.nav {
			top: auto;
			bottom: 12px;
			transform: none;
		}
	}
</style>
