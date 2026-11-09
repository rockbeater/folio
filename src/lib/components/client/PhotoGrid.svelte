<script lang="ts">
	import Heart from '@lucide/svelte/icons/heart';
	import Download from '@lucide/svelte/icons/download';
	import Check from '@lucide/svelte/icons/check';
	import Lock from '@lucide/svelte/icons/lock';
	import { useI18n } from '$lib/i18n';
	import { displaySrcset, displayUrl, type GridSize, type GridStyle, type PhotoView } from '$lib/types';

	interface Props {
		photos: PhotoView[];
		gridStyle: GridStyle;
		size: GridSize;
		spacing: GridSize;
		favorites: Set<string>;
		showFilenames?: boolean;
		canFavorite: boolean;
		canDownload: boolean;
		onopen: (index: number) => void;
		onfavorite: (id: string) => void;
		ondownload: (id: string) => void;
		/** Show a lock on photos the client marked private. */
		isPrivate?: (photo: PhotoView) => boolean;
		/** When set, clicking a photo selects it instead of opening it. */
		selection?: Set<string> | null;
		onselect?: (id: string) => void;
	}

	let {
		photos,
		gridStyle,
		size,
		spacing,
		favorites,
		showFilenames = false,
		canFavorite,
		canDownload,
		onopen,
		onfavorite,
		ondownload,
		isPrivate = () => false,
		selection = null,
		onselect = () => undefined
	}: Props = $props();
	const { t } = useI18n();

	let width = $state(0);
	// Before the first measurement (server render) assume a desktop width and keep the grid hidden.
	const layoutWidth = $derived(width || 1280);

	// Breakpoints follow DESIGN.md: mobile < 768, tablet < 1024, desktop < 1920, large screens above.
	function bucket(w: number): 0 | 1 | 2 | 3 {
		if (w < 768) return 0;
		if (w < 1024) return 1;
		if (w < 1920) return 2;
		return 3;
	}

	const COLUMNS = { regular: [2, 3, 4, 5], large: [1, 2, 3, 4] } as const;
	const columnCount = $derived(COLUMNS[size][bucket(layoutWidth)]);
	const gap = $derived(spacing === 'large' ? (layoutWidth < 768 ? 12 : 24) : layoutWidth < 768 ? 4 : 8);

	/** Masonry that keeps left-to-right order: each photo goes into the currently shortest column. */
	const columns = $derived.by(() => {
		if (gridStyle !== 'vertical') return [];
		const heights: number[] = Array(columnCount).fill(0);
		const out: { photo: PhotoView; index: number }[][] = Array.from({ length: columnCount }, () => []);
		photos.forEach((photo, index) => {
			let target = 0;
			for (let c = 1; c < columnCount; c++) if (heights[c] < heights[target] - 0.01) target = c;
			out[target].push({ photo, index });
			heights[target] += photo.height / photo.width;
		});
		return out;
	});

	const masonrySizes = $derived(
		size === 'regular'
			? '(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1919px) 25vw, 20vw'
			: '(max-width: 767px) 100vw, (max-width: 1023px) 50vw, (max-width: 1919px) 33vw, 25vw'
	);

	function rowSizes(photo: PhotoView): string {
		const ar = photo.width / photo.height;
		const heights = size === 'regular' ? [160, 220, 280, 320] : [240, 320, 400, 480];
		return `(max-width: 767px) ${Math.round(heights[0] * ar)}px, (max-width: 1023px) ${Math.round(heights[1] * ar)}px, (max-width: 1919px) ${Math.round(heights[2] * ar)}px, ${Math.round(heights[3] * ar)}px`;
	}

	/** Fade photos in once loaded; photos that are already loaded show immediately. */
	function fadeIn(img: HTMLImageElement) {
		if (img.complete && img.naturalWidth > 0) return;
		img.classList.add('waiting');
		const done = () => img.classList.remove('waiting');
		img.addEventListener('load', done, { once: true });
		img.addEventListener('error', done, { once: true });
	}
</script>

{#snippet tile(photo: PhotoView, index: number, sizes: string)}
	<div class="cell">
	<figure
		class="tile"
		class:selected={selection?.has(photo.id)}
		style:aspect-ratio="{photo.width} / {photo.height}"
		style:background-color={photo.color}
	>
		<button
			type="button"
			class="open"
			onclick={() => (selection ? onselect(photo.id) : onopen(index))}
			aria-label={photo.filename}
			aria-pressed={selection ? selection.has(photo.id) : undefined}
		>
			<img
				src={displayUrl(photo, 480)}
				srcset={displaySrcset(photo)}
				{sizes}
				alt=""
				loading={index < 8 ? 'eager' : 'lazy'}
				decoding="async"
				{@attach fadeIn}
			/>
		</button>
		{#if selection}
			<span class="check" aria-hidden="true">{#if selection.has(photo.id)}<Check size={16} strokeWidth={2.5} />{/if}</span>
		{:else if canFavorite || canDownload}
			<div class="actions">
				{#if canFavorite}
					<button
						type="button"
						onclick={() => onfavorite(photo.id)}
						aria-label={favorites.has(photo.id) ? t('client.removeFavorite') : t('client.addFavorite')}
						aria-pressed={favorites.has(photo.id)}
					>
						<Heart size={20} strokeWidth={1.5} fill={favorites.has(photo.id) ? 'currentColor' : 'none'} />
					</button>
				{/if}
				{#if canDownload}
					<button type="button" onclick={() => ondownload(photo.id)} aria-label={t('client.downloadPhoto')}>
						<Download size={20} strokeWidth={1.5} />
					</button>
				{/if}
			</div>
		{/if}
		{#if isPrivate(photo)}
			<span class="lock" title={t('client.private.badge')}><Lock size={14} strokeWidth={2} /><span class="visually-hidden">{t('client.private.badge')}</span></span>
		{/if}
		{#if favorites.has(photo.id)}
			<span class="mark" aria-hidden="true"><Heart size={16} strokeWidth={1.5} fill="currentColor" /></span>
		{/if}
	</figure>
	{#if showFilenames}<p class="caption">{photo.filename}</p>{/if}
	</div>
{/snippet}

<div class="grid" bind:clientWidth={width} style:--gap="{gap}px">
	{#if gridStyle === 'vertical'}
		<div class="masonry" class:pending={width === 0}>
			{#each columns as column, c (c)}
				<div class="column">
					{#each column as item (item.photo.id)}
						{@render tile(item.photo, item.index, masonrySizes)}
					{/each}
				</div>
			{/each}
		</div>
	{:else}
		<div class="rows" class:large={size === 'large'}>
			{#each photos as photo, index (photo.id)}
				<div
					class="row-item"
					style:flex-grow={photo.width / photo.height}
					style:flex-basis="calc(var(--row-h) * {photo.width / photo.height})"
				>
					{@render tile(photo, index, rowSizes(photo))}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.grid {
		width: 100%;
	}

	.masonry {
		display: flex;
		align-items: flex-start;
		gap: var(--gap);
	}

	.masonry.pending {
		visibility: hidden;
		min-height: 100vh;
	}

	.column {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	.rows {
		--row-h: 160px;
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap);
	}

	.rows::after {
		content: '';
		flex-grow: 1000000;
	}

	@media (min-width: 768px) {
		.rows {
			--row-h: 220px;
		}
	}
	@media (min-width: 1024px) {
		.rows {
			--row-h: 280px;
		}
	}
	@media (min-width: 1920px) {
		.rows {
			--row-h: 320px;
		}
	}

	.rows.large {
		--row-h: 240px;
	}
	@media (min-width: 768px) {
		.rows.large {
			--row-h: 320px;
		}
	}
	@media (min-width: 1024px) {
		.rows.large {
			--row-h: 400px;
		}
	}
	@media (min-width: 1920px) {
		.rows.large {
			--row-h: 480px;
		}
	}

	.row-item {
		min-width: 0;
	}

	.tile {
		position: relative;
		margin: 0;
		width: 100%;
		overflow: hidden;
	}

	.open {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: zoom-in;
	}

	.open img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: opacity var(--dur-big) var(--ease-out);
	}

	.open :global(img.waiting) {
		opacity: 0;
	}

	.actions {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: none;
		justify-content: flex-end;
		gap: var(--space-1);
		padding: var(--space-6) var(--space-2) var(--space-2);
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.38));
		color: #ffffff;
		pointer-events: none;
	}

	.actions button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 0;
		background: none;
		color: inherit;
		pointer-events: auto;
	}

	@media (hover: hover) {
		.tile:hover .actions,
		.tile:focus-within .actions {
			display: flex;
		}
	}

	.caption {
		margin: 4px 0 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mark {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		color: #ffffff;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
		pointer-events: none;
	}

	@media (hover: hover) {
		.tile:hover .mark {
			display: none;
		}
	}

	.lock {
		position: absolute;
		top: 8px;
		left: 8px;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		pointer-events: none;
	}

	.check {
		position: absolute;
		top: 8px;
		right: 8px;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 2px solid #fff;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.25);
		color: #fff;
		pointer-events: none;
	}

	.selected .check {
		background: var(--color-accent);
		border-color: var(--color-accent);
	}

	.selected img {
		opacity: 0.75;
	}
</style>
