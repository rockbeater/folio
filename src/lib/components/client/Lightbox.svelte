<script lang="ts">
	import { onMount } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import Heart from '@lucide/svelte/icons/heart';
	import Download from '@lucide/svelte/icons/download';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import { useI18n } from '$lib/i18n';
	import { displaySrcset, displayUrl, DISPLAY_WIDTHS, type PhotoView } from '$lib/types';

	interface Props {
		photos: PhotoView[];
		index: number;
		favorites: Set<string>;
		canFavorite: boolean;
		canDownload: boolean;
		canSlideshow?: boolean;
		/** Start playing the slideshow right away. */
		autoplay?: boolean;
		showFilenames?: boolean;
		onchange: (index: number) => void;
		onclose: () => void;
		onfavorite: (id: string) => void;
		ondownload: (id: string) => void;
	}

	let {
		photos,
		index,
		favorites,
		canFavorite,
		canDownload,
		canSlideshow = false,
		autoplay = false,
		showFilenames = false,
		onchange,
		onclose,
		onfavorite,
		ondownload
	}: Props = $props();
	const { t } = useI18n();

	let dialog: HTMLDialogElement;
	const photo = $derived(photos[index]);

	// Zoom and pan of the current photo; swipe offset of the track.
	let scale = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let dragX = $state(0);
	let dragY = $state(0);
	let dragging = $state(false);
	let controlsVisible = $state(true);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	// svelte-ignore state_referenced_locally
	let playing = $state(autoplay);

	// Slideshow: advance every few seconds and stop at the last photo.
	$effect(() => {
		if (!playing) return;
		const current = index;
		const timer = setTimeout(() => {
			if (current < photos.length - 1) go(1);
			else playing = false;
		}, 4500);
		return () => clearTimeout(timer);
	});

	onMount(() => {
		dialog.showModal();
		document.documentElement.style.overflow = 'hidden';
		showControls();
		return () => {
			document.documentElement.style.overflow = '';
			clearTimeout(hideTimer);
			if (dialog.open) dialog.close();
		};
	});

	// Preload neighbours so swiping feels instant.
	$effect(() => {
		for (const n of [index - 1, index + 1]) {
			const p = photos[n];
			if (!p) continue;
			const img = new Image();
			img.sizes = '100vw';
			img.srcset = displaySrcset(p);
		}
	});

	function resetZoom() {
		scale = 1;
		panX = 0;
		panY = 0;
	}

	function go(delta: number) {
		const next = index + delta;
		if (next < 0 || next >= photos.length) return;
		resetZoom();
		onchange(next);
	}

	function showControls() {
		controlsVisible = true;
		clearTimeout(hideTimer);
		if (matchMedia('(hover: hover)').matches) hideTimer = setTimeout(() => (controlsVisible = false), 3000);
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'ArrowRight') go(1);
		else if (event.key === 'ArrowLeft') go(-1);
		else if (event.key === ' ' && canSlideshow) playing = !playing;
		else return;
		event.preventDefault();
		showControls();
	}

	function toggleZoom(clientX: number, clientY: number, stage: HTMLElement) {
		if (scale > 1) {
			resetZoom();
			return;
		}
		const rect = stage.getBoundingClientRect();
		scale = 2.5;
		panX = (rect.width / 2 - (clientX - rect.left)) * 1.5;
		panY = (rect.height / 2 - (clientY - rect.top)) * 1.5;
	}

	const pointers = new Map<number, { x: number; y: number }>();
	let start = { x: 0, y: 0, panX: 0, panY: 0, time: 0 };
	let pinch: { distance: number; scale: number } | null = null;
	let lastTap = 0;
	let moved = false;

	function distance() {
		const [a, b] = [...pointers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function onPointerDown(event: PointerEvent) {
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size === 2) {
			pinch = { distance: distance(), scale };
		} else {
			start = { x: event.clientX, y: event.clientY, panX, panY, time: Date.now() };
			moved = false;
			dragging = true;
		}
	}

	function onPointerMove(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) {
			if (event.pointerType === 'mouse') showControls();
			return;
		}
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pinch && pointers.size === 2) {
			scale = Math.min(4, Math.max(1, (pinch.scale * distance()) / pinch.distance));
			if (scale === 1) resetZoom();
			return;
		}
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
		if (scale > 1) {
			panX = start.panX + dx;
			panY = start.panY + dy;
		} else if (event.pointerType !== 'mouse') {
			if (Math.abs(dx) > Math.abs(dy)) {
				dragX = dx;
				dragY = 0;
			} else if (dy > 0) {
				dragY = dy;
				dragX = 0;
			}
		}
	}

	function onPointerUp(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (pointers.size > 0) return;
		const wasPinch = pinch !== null;
		pinch = null;
		dragging = false;
		const stage = event.currentTarget as HTMLElement;

		if (!wasPinch && scale === 1) {
			if (dragX < -60) go(1);
			else if (dragX > 60) go(-1);
			else if (dragY > 120) {
				onclose();
				return;
			}
		}
		dragX = 0;
		dragY = 0;

		if (!moved && !wasPinch && Date.now() - start.time < 300) {
			const now = Date.now();
			if (now - lastTap < 300) {
				toggleZoom(event.clientX, event.clientY, stage);
				lastTap = 0;
			} else {
				lastTap = now;
				if (event.pointerType !== 'mouse') {
					const tapTime = now;
					setTimeout(() => {
						if (lastTap === tapTime) controlsVisible = !controlsVisible;
					}, 300);
				}
			}
		}
	}

	const backdropOpacity = $derived(dragY > 0 ? Math.max(0.3, 1 - dragY / 400) : 1);
</script>

<dialog
	bind:this={dialog}
	class="lightbox"
	class:hide-controls={!controlsVisible}
	aria-label={photo?.filename}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
	onkeydown={onKey}
	style:--backdrop-opacity={backdropOpacity}
>
	{#if photo}
		<div class="top">
			<button type="button" class="icon" onclick={onclose} aria-label={t('common.close')}>
				<X size={24} strokeWidth={1.5} />
			</button>
			<span class="label counter tabular">
				{t('client.counter', { current: index + 1, total: photos.length })}
				{#if showFilenames}<span class="filename">{photo.filename}</span>{/if}
			</span>
			<div class="top-actions">
				{#if canSlideshow}
					<button
						type="button"
						class="icon"
						onclick={() => (playing = !playing)}
						aria-label={playing ? t('client.slideshow.pause') : t('client.slideshow.play')}
					>
						{#if playing}<Pause size={22} strokeWidth={1.5} />{:else}<Play size={22} strokeWidth={1.5} />{/if}
					</button>
				{/if}
				{#if canFavorite}
					<button
						type="button"
						class="icon"
						onclick={() => onfavorite(photo.id)}
						aria-label={favorites.has(photo.id) ? t('client.removeFavorite') : t('client.addFavorite')}
						aria-pressed={favorites.has(photo.id)}
					>
						<Heart size={22} strokeWidth={1.5} fill={favorites.has(photo.id) ? 'currentColor' : 'none'} />
					</button>
				{/if}
				{#if canDownload}
					<button type="button" class="icon" onclick={() => ondownload(photo.id)} aria-label={t('client.downloadPhoto')}>
						<Download size={22} strokeWidth={1.5} />
					</button>
				{/if}
			</div>
		</div>

		<div
			class="stage"
			role="presentation"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			<div class="track" class:dragging style:transform="translate3d({dragX}px, {dragY}px, 0)">
				{#key photo.id}
					<img
						src={displayUrl(photo, DISPLAY_WIDTHS[2])}
						srcset={displaySrcset(photo)}
						sizes="100vw"
						alt={photo.filename}
						draggable="false"
						style:aspect-ratio="{photo.width} / {photo.height}"
						style:--ar={photo.width / photo.height}
						style:background-color={photo.color}
						style:transform="translate({panX}px, {panY}px) scale({scale})"
						class:zoomed={scale > 1}
					/>
				{/key}
			</div>
		</div>

		{#if index > 0}
			<button type="button" class="nav prev" onclick={() => go(-1)} aria-label={t('client.previous')}>
				<ChevronLeft size={32} strokeWidth={1.25} />
			</button>
		{/if}
		{#if index < photos.length - 1}
			<button type="button" class="nav next" onclick={() => go(1)} aria-label={t('client.next')}>
				<ChevronRight size={32} strokeWidth={1.25} />
			</button>
		{/if}
	{/if}
</dialog>

<style>
	.lightbox {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: color-mix(in srgb, var(--color-bg) calc(var(--backdrop-opacity) * 100%), transparent);
		color: var(--color-text);
		overflow: hidden;
		animation: fade-in var(--dur-big) var(--ease-out);
	}

	.lightbox::backdrop {
		background: transparent;
	}

	.top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 2;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: calc(var(--space-2) + env(safe-area-inset-top)) var(--space-3) var(--space-2);
		transition: opacity var(--dur-ui) var(--ease-out);
	}

	.counter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		color: var(--color-text-muted);
	}

	.filename {
		font-family: var(--font-body);
		font-size: 0.75rem;
		letter-spacing: 0;
		text-transform: none;
	}

	.top-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-1);
	}

	.icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		background: none;
	}

	.stage {
		position: absolute;
		inset: 0;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.track {
		position: absolute;
		inset: 64px 72px;
		display: flex;
		align-items: center;
		justify-content: center;
		container-type: size;
		transition: transform var(--dur-ui) var(--ease-out);
	}

	.track.dragging {
		transition: none;
	}

	.track img {
		/* Fit inside the stage while keeping the photo's aspect ratio, even before it has loaded. */
		width: min(100cqw, calc(100cqh * var(--ar)));
		height: auto;
		object-fit: contain;
		transition: transform var(--dur-ui) var(--ease-out);
		animation: fade-in var(--dur-big) var(--ease-out);
		cursor: zoom-in;
	}

	.track img.zoomed {
		cursor: grab;
	}

	.nav {
		position: absolute;
		top: 50%;
		z-index: 2;
		display: grid;
		place-items: center;
		width: 56px;
		height: 88px;
		margin-top: -44px;
		border: 0;
		background: none;
		transition: opacity var(--dur-ui) var(--ease-out);
	}

	.prev {
		left: var(--space-2);
	}

	.next {
		right: var(--space-2);
	}

	.hide-controls .top,
	.hide-controls .nav {
		opacity: 0;
	}

	@media (max-width: 767px) {
		.track {
			inset: 56px 0 calc(16px + env(safe-area-inset-bottom));
		}

		.nav {
			display: none;
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
</style>
