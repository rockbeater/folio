<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n } from '$lib/i18n';
	import { displayUrl, type PhotoView } from '$lib/types';
	import type { Crop } from '$lib/store';

	interface Props {
		photo: PhotoView;
		/** Long side / short side of the print. */
		aspect: number;
		crop: Crop | null;
		onsave: (crop: Crop) => void;
		onclose: () => void;
	}

	let { photo, aspect, crop, onsave, onclose }: Props = $props();
	const { t } = useI18n();
	// svelte-ignore state_referenced_locally
	const ratio = photo.width / photo.height;

	// svelte-ignore state_referenced_locally
	const startLandscape = crop ? (crop.w * photo.width) / (crop.h * photo.height) >= 1 : photo.width >= photo.height;
	// svelte-ignore state_referenced_locally
	const startTarget = startLandscape ? aspect : 1 / aspect;
	// svelte-ignore state_referenced_locally
	const startScale = crop ? crop.w / (ratio > startTarget ? startTarget / ratio : 1) : 1;

	let landscape = $state(startLandscape);
	let scale = $state(Math.min(1, Math.max(0.3, startScale)));
	const target = $derived(landscape ? aspect : 1 / aspect);
	const max = $derived(ratio > target ? { w: target / ratio, h: 1 } : { w: 1, h: ratio / target });
	const w = $derived(max.w * scale);
	const h = $derived(max.h * scale);
	// svelte-ignore state_referenced_locally
	let x = $state(crop?.x ?? 0);
	// svelte-ignore state_referenced_locally
	let y = $state(crop?.y ?? 0);
	const clamp = (v: number, size: number) => Math.min(1 - size, Math.max(0, v));
	const cx = $derived(clamp(x, w));
	const cy = $derived(clamp(y, h));

	let stage: HTMLDivElement;
	let drag: { px: number; py: number; x: number; y: number } | null = null;

	function down(event: PointerEvent) {
		drag = { px: event.clientX, py: event.clientY, x: cx, y: cy };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function move(event: PointerEvent) {
		if (!drag) return;
		const rect = stage.getBoundingClientRect();
		x = clamp(drag.x + (event.clientX - drag.px) / rect.width, w);
		y = clamp(drag.y + (event.clientY - drag.py) / rect.height, h);
	}

	function key(event: KeyboardEvent) {
		const step = 0.02;
		if (event.key === 'ArrowLeft') x = clamp(cx - step, w);
		else if (event.key === 'ArrowRight') x = clamp(cx + step, w);
		else if (event.key === 'ArrowUp') y = clamp(cy - step, h);
		else if (event.key === 'ArrowDown') y = clamp(cy + step, h);
		else return;
		event.preventDefault();
	}

	function center() {
		x = (1 - w) / 2;
		y = (1 - h) / 2;
	}
</script>

<Modal title={t('store.crop.title')} {onclose} wide>
	<div class="crop">
		<p class="hint">{t('store.crop.hint')}</p>
		<div class="stage" bind:this={stage} style:aspect-ratio="{photo.width} / {photo.height}">
			<img src={displayUrl(photo, 1600)} alt="" draggable="false" />
			<div
				class="frame"
				role="slider"
				tabindex="0"
				aria-label={t('store.crop.title')}
				aria-valuenow={Math.round(cx * 100)}
				style:left="{cx * 100}%"
				style:top="{cy * 100}%"
				style:width="{w * 100}%"
				style:height="{h * 100}%"
				onpointerdown={down}
				onpointermove={move}
				onpointerup={() => (drag = null)}
				onkeydown={key}
			></div>
		</div>
		<div class="controls">
			<label class="zoom">
				<span class="label">{t('store.crop.size')}</span>
				<input type="range" min="0.3" max="1" step="0.01" bind:value={scale} />
			</label>
			<button class="c-btn small" type="button" onclick={() => ((landscape = !landscape), center())}>{t('store.crop.rotate')}</button>
			<button class="c-btn small ghost" type="button" onclick={center}>{t('store.crop.center')}</button>
		</div>
		<div class="actions">
			<button class="c-btn ghost" type="button" onclick={onclose}>{t('common.cancel')}</button>
			<button class="c-btn solid" type="button" onclick={() => onsave({ x: cx, y: cy, w, h })}>{t('common.save')}</button>
		</div>
	</div>
</Modal>

<style>
	.crop {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.hint {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.stage {
		position: relative;
		max-height: 60vh;
		max-width: 100%;
		margin: 0 auto;
		overflow: hidden;
		user-select: none;
		touch-action: none;
	}

	.stage img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
	}

	.frame {
		position: absolute;
		border: 2px solid #fff;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
		cursor: move;
	}

	.controls,
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.actions {
		justify-content: flex-end;
	}

	.zoom {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1;
		min-width: 200px;
	}

	.zoom input {
		flex: 1;
	}
</style>
