<script lang="ts">
	import Monitor from '@lucide/svelte/icons/monitor';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import { callAction } from '$lib/admin-actions';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import {
		COVER_LAYOUTS,
		FONT_SETS,
		GRID_SIZES,
		GRID_STYLES,
		NAV_STYLES,
		THEMES,
		displayUrl,
		type GalleryDesign
	} from '$lib/types';
	import type { AdminPhoto, EditorGallery } from './editor-types';

	let { gallery, cover }: { gallery: EditorGallery; cover: AdminPhoto | null } = $props();
	const { t } = useI18n();

	// svelte-ignore state_referenced_locally
	let design = $state<GalleryDesign>({ ...gallery.design });
	// svelte-ignore state_referenced_locally
	let focal = $state({ x: gallery.coverFocalX, y: gallery.coverFocalY });
	let device = $state<'desktop' | 'mobile'>('desktop');
	let stageWidth = $state(0);
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let previewKey = $state(0);

	const DEVICE = { desktop: { w: 1440, h: 900 }, mobile: { w: 390, h: 844 } } as const;
	const frame = $derived(DEVICE[device]);
	const scale = $derived(stageWidth ? Math.min(1, (stageWidth - 2) / frame.w) : 0.5);
	const previewSrc = $derived(`/g/${gallery.slug}?design=${encodeURIComponent(JSON.stringify(design))}&k=${previewKey}`);

	function update<K extends keyof GalleryDesign>(key: K, value: GalleryDesign[K]) {
		design = { ...design, [key]: value };
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => callAction('design', { design }, { invalidate: false }), 400);
	}

	async function setFocal(event: MouseEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		focal = {
			x: Math.round(((event.clientX - rect.left) / rect.width) * 100) / 100,
			y: Math.round(((event.clientY - rect.top) / rect.height) * 100) / 100
		};
		await callAction('focal', focal, { invalidate: false });
		previewKey += 1;
	}

	const SWATCH: Record<string, [string, string]> = {
		light: ['#ffffff', '#1e1e1e'],
		sand: ['#f6f1ea', '#2a2520'],
		dark: ['#121212', '#f2f2f2'],
		black: ['#000000', '#ffffff']
	};
	const FONT_PREVIEW: Record<string, string> = {
		modern: "'Jost Variable'",
		classic: "'Cormorant Garamond Variable'",
		editorial: "'Playfair Display Variable'",
		minimal: "'Inter Variable'"
	};
</script>

<div class="design">
	<div class="options stack">
		<section class="stack-sm">
			<h3 class="field-label">{t('admin.design.cover')}</h3>
			<div class="covers">
				{#each COVER_LAYOUTS as layout (layout)}
					<label class="choice">
						<input type="radio" name="cover" checked={design.cover === layout} onchange={() => update('cover', layout)} />
						<span class="cover-icon cover-icon--{layout}" aria-hidden="true"><i></i><b></b></span>
						{t(`admin.design.cover.${layout}` as MessageKey)}
					</label>
				{/each}
			</div>
		</section>

		<section class="stack-sm">
			<h3 class="field-label">{t('admin.design.focal')}</h3>
			{#if cover}
				<button class="focal" type="button" onclick={setFocal} aria-label={t('admin.design.focal')}>
					<img src={displayUrl(cover, 960)} alt="" />
					<span class="dot" style:left="{focal.x * 100}%" style:top="{focal.y * 100}%"></span>
				</button>
				<p class="hint">{t('admin.design.focalHint')}</p>
			{:else}
				<p class="hint">{t('admin.design.coverPhotoHint')}</p>
			{/if}
		</section>

		<section class="stack-sm">
			<h3 class="field-label">{t('admin.design.typography')}</h3>
			<div class="segmented two">
				{#each FONT_SETS as set (set)}
					<label class="choice">
						<input type="radio" name="fonts" checked={design.fonts === set} onchange={() => update('fonts', set)} />
						<span class="font-sample" style:font-family={FONT_PREVIEW[set]}>Aa</span>
						{t(`admin.design.fonts.${set}` as MessageKey)}
					</label>
				{/each}
			</div>
		</section>

		<section class="stack-sm">
			<h3 class="field-label">{t('admin.design.color')}</h3>
			<div class="segmented four">
				{#each THEMES as theme (theme)}
					<label class="choice">
						<input type="radio" name="theme" checked={design.theme === theme} onchange={() => update('theme', theme)} />
						<span class="swatch" style:background={SWATCH[theme][0]} style:color={SWATCH[theme][1]}>Aa</span>
						{t(`admin.design.theme.${theme}` as MessageKey)}
					</label>
				{/each}
			</div>
		</section>

		<section class="stack-sm">
			<h3 class="field-label">{t('admin.design.grid')}</h3>
			<p class="hint">{t('admin.design.gridStyle')}</p>
			<div class="segmented">
				{#each GRID_STYLES as style (style)}
					<label class="choice">
						<input type="radio" name="gridStyle" checked={design.gridStyle === style} onchange={() => update('gridStyle', style)} />
						<span class="grid-icon grid-icon--{style}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
						{t(`admin.design.gridStyle.${style}` as MessageKey)}
					</label>
				{/each}
			</div>
			<p class="hint">{t('admin.design.thumbSize')}</p>
			<div class="segmented">
				{#each GRID_SIZES as size (size)}
					<label class="choice">
						<input type="radio" name="thumbSize" checked={design.thumbSize === size} onchange={() => update('thumbSize', size)} />
						{t(`admin.design.size.${size}` as MessageKey)}
					</label>
				{/each}
			</div>
			<p class="hint">{t('admin.design.gridSpacing')}</p>
			<div class="segmented">
				{#each GRID_SIZES as size (size)}
					<label class="choice">
						<input type="radio" name="gridSpacing" checked={design.gridSpacing === size} onchange={() => update('gridSpacing', size)} />
						{t(`admin.design.size.${size}` as MessageKey)}
					</label>
				{/each}
			</div>
			<p class="hint">{t('admin.design.navStyle')}</p>
			<div class="segmented">
				{#each NAV_STYLES as style (style)}
					<label class="choice">
						<input type="radio" name="navStyle" checked={design.navStyle === style} onchange={() => update('navStyle', style)} />
						{t(`admin.design.navStyle.${style}` as MessageKey)}
					</label>
				{/each}
			</div>
		</section>
	</div>

	<div class="preview">
		<div class="devices segmented">
			<label class="choice">
				<input type="radio" name="device" checked={device === 'desktop'} onchange={() => (device = 'desktop')} />
				<Monitor size={16} />{t('admin.design.desktop')}
			</label>
			<label class="choice">
				<input type="radio" name="device" checked={device === 'mobile'} onchange={() => (device = 'mobile')} />
				<Smartphone size={16} />{t('admin.design.mobile')}
			</label>
		</div>
		<div class="stage" bind:clientWidth={stageWidth}>
			<div class="frame-wrap" style:width="{frame.w * scale}px" style:height="{frame.h * scale}px">
				<iframe
					title={t('admin.editor.preview')}
					src={previewSrc}
					style:width="{frame.w}px"
					style:height="{frame.h}px"
					style:transform="scale({scale})"
				></iframe>
			</div>
		</div>
	</div>
</div>

<style>
	.design {
		display: grid;
		grid-template-columns: minmax(280px, 340px) 1fr;
		gap: 28px;
		align-items: start;
	}

	.options {
		gap: 28px;
	}

	.stack-sm {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.covers {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
	}

	.segmented.two {
		grid-auto-flow: row;
		grid-template-columns: repeat(2, 1fr);
	}

	.segmented.four {
		grid-auto-flow: row;
		grid-template-columns: repeat(4, 1fr);
	}

	.cover-icon {
		position: relative;
		width: 64px;
		height: 42px;
		border: 1px solid currentColor;
		border-radius: 3px;
		overflow: hidden;
		opacity: 0.8;
	}

	.cover-icon i {
		position: absolute;
		inset: 0;
		background: currentColor;
		opacity: 0.25;
	}

	.cover-icon b {
		position: absolute;
		left: 20%;
		right: 20%;
		top: 45%;
		height: 3px;
		background: currentColor;
	}

	.cover-icon--bottom b {
		left: 10%;
		right: 50%;
		top: 75%;
	}

	.cover-icon--split i {
		right: 45%;
	}

	.cover-icon--split b {
		left: 62%;
		right: 8%;
	}

	.cover-icon--frame i {
		inset: 5px 5px 12px;
	}

	.cover-icon--frame b {
		top: auto;
		bottom: 4px;
		left: 30%;
		right: 30%;
		height: 2px;
	}

	.cover-icon--none i {
		display: none;
	}

	.cover-icon--none b {
		top: 6px;
		left: 6px;
		right: 50%;
	}

	.focal {
		position: relative;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: none;
		overflow: hidden;
		cursor: crosshair;
	}

	.focal img {
		width: 100%;
		height: auto;
	}

	.dot {
		position: absolute;
		width: 22px;
		height: 22px;
		margin: -11px 0 0 -11px;
		border: 2px solid #fff;
		border-radius: 50%;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.4),
			inset 0 0 0 1px rgba(0, 0, 0, 0.4);
		pointer-events: none;
	}

	.font-sample {
		font-size: 1.5rem;
		line-height: 1;
	}

	.swatch {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 1px solid var(--line);
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.grid-icon {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px;
		width: 28px;
	}

	.grid-icon i {
		background: currentColor;
		opacity: 0.6;
		height: 9px;
	}

	.grid-icon--vertical i:nth-child(1),
	.grid-icon--vertical i:nth-child(4) {
		height: 14px;
	}

	.grid-icon--vertical i:nth-child(2) {
		height: 6px;
	}

	.preview {
		position: sticky;
		top: 72px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.devices {
		align-self: flex-start;
	}

	.devices .choice {
		flex-direction: row;
		padding: 6px 14px;
		min-height: 36px;
	}

	.stage {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.frame-wrap {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: #fff;
	}

	iframe {
		position: absolute;
		top: 0;
		left: 0;
		border: 0;
		transform-origin: 0 0;
	}

	@media (max-width: 1100px) {
		.design {
			grid-template-columns: 1fr;
		}

		.preview {
			position: static;
		}
	}
</style>
