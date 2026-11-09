<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { WATERMARK_POSITIONS, type WatermarkPosition } from '$lib/types';
	import type { SubmitFunction } from '@sveltejs/kit';

	interface Watermark {
		id: string;
		name: string;
		kind: 'image' | 'text';
		text: { text: string; font: string; color: string } | null;
		position: WatermarkPosition;
		scale: number;
		opacity: number;
		version: number;
	}

	let { watermarks, saved }: { watermarks: Watermark[]; saved: SubmitFunction } = $props();
	const { t } = useI18n();

	const FONTS: Record<string, string> = {
		modern: "'Jost Variable'",
		classic: "'Cormorant Garamond Variable'",
		editorial: "'Playfair Display Variable'",
		minimal: "'Inter Variable'"
	};

	interface Draft {
		id: string;
		name: string;
		kind: 'image' | 'text';
		text: string;
		font: string;
		color: string;
		position: WatermarkPosition;
		scale: number;
		opacity: number;
		previewSrc: string | null;
	}

	let draft = $state<Draft | null>(null);
	let rendered = $state('');

	function edit(wm: Watermark | null) {
		draft = wm
			? {
					id: wm.id,
					name: wm.name,
					kind: wm.kind,
					text: wm.text?.text ?? '',
					font: wm.text?.font ?? 'modern',
					color: wm.text?.color ?? '#ffffff',
					position: wm.position,
					scale: wm.scale,
					opacity: wm.opacity,
					previewSrc: `/admin/api/watermarks/${wm.id}?v=${wm.version}`
				}
			: { id: '', name: '', kind: 'text', text: '', font: 'modern', color: '#ffffff', position: 'bottom-right', scale: 0.3, opacity: 0.6, previewSrc: null };
		rendered = '';
	}

	/** Text watermarks are drawn in the browser (with Folio's fonts) and uploaded as PNG. */
	async function renderText() {
		if (!draft || draft.kind !== 'text' || !draft.text.trim()) {
			rendered = '';
			return;
		}
		const family = FONTS[draft.font] ?? FONTS.modern;
		const size = 160;
		await document.fonts.load(`500 ${size}px ${family}`);
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d')!;
		ctx.font = `500 ${size}px ${family}`;
		const width = Math.ceil(ctx.measureText(draft.text).width) + 40;
		canvas.width = width;
		canvas.height = Math.ceil(size * 1.4);
		ctx.font = `500 ${size}px ${family}`;
		ctx.fillStyle = draft.color;
		ctx.textBaseline = 'middle';
		ctx.fillText(draft.text, 20, canvas.height / 2);
		rendered = canvas.toDataURL('image/png');
		draft.previewSrc = rendered;
	}

	$effect(() => {
		if (draft?.kind === 'text') {
			void draft.text;
			void draft.font;
			void draft.color;
			void renderText();
		}
	});

	function onImage(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file && draft) draft.previewSrc = URL.createObjectURL(file);
	}

	const gravity: Record<WatermarkPosition, string> = {
		'top-left': 'flex-start flex-start',
		top: 'flex-start center',
		'top-right': 'flex-start flex-end',
		left: 'center flex-start',
		center: 'center center',
		right: 'center flex-end',
		'bottom-left': 'flex-end flex-start',
		bottom: 'flex-end center',
		'bottom-right': 'flex-end flex-end',
		tile: 'center center'
	};
</script>

<p class="hint intro">{t('admin.watermarks.intro')}</p>

{#if watermarks.length > 0}
	<ul class="list">
		{#each watermarks as wm (wm.id)}
			<li class="card">
				<div class="thumb"><img src="/admin/api/watermarks/{wm.id}?v={wm.version}" alt="" /></div>
				<strong>{wm.name}</strong>
				<div class="row">
					<button class="btn small" type="button" onclick={() => edit(wm)}>{t('common.edit')}</button>
					<form
						method="POST"
						action="?/deleteWatermark"
						use:enhance={(input) => {
							if (!confirm(t('admin.watermarks.deleteConfirm', { name: wm.name }))) input.cancel();
							return saved(input);
						}}
					>
						<input type="hidden" name="id" value={wm.id} />
						<button class="btn small ghost danger" type="submit">{t('common.delete')}</button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

{#if draft}
	<form
		class="card block"
		method="POST"
		action="?/saveWatermark"
		enctype="multipart/form-data"
		use:enhance={(input) => {
			const after = saved(input);
			return async (opts) => {
				await (after as (o: typeof opts) => Promise<void>)?.(opts);
				if (opts.result.type === 'success') draft = null;
			};
		}}
	>
		<input type="hidden" name="id" value={draft.id} />
		<input type="hidden" name="rendered" value={draft.kind === 'text' ? rendered : ''} />
		<label class="field">
			<span>{t('common.name')}</span>
			<input type="text" name="name" bind:value={draft.name} required />
		</label>
		<div class="segmented">
			<label class="choice"><input type="radio" name="kind" value="text" bind:group={draft.kind} />{t('admin.watermarks.text')}</label>
			<label class="choice"><input type="radio" name="kind" value="image" bind:group={draft.kind} />{t('admin.watermarks.image')}</label>
		</div>
		{#if draft.kind === 'text'}
			<div class="two">
				<label class="field">
					<span>{t('admin.watermarks.textLabel')}</span>
					<input type="text" name="text" bind:value={draft.text} placeholder="© Studio" />
				</label>
				<label class="field">
					<span>{t('admin.watermarks.color')}</span>
					<input type="color" name="color" bind:value={draft.color} />
				</label>
			</div>
			<label class="field">
				<span>{t('admin.design.typography')}</span>
				<select name="font" bind:value={draft.font}>
					{#each Object.keys(FONTS) as font (font)}<option value={font}>{t(`admin.design.fonts.${font}` as MessageKey)}</option>{/each}
				</select>
			</label>
		{:else}
			<label class="field">
				<span>{t('admin.watermarks.imageLabel')}</span>
				<input type="file" name="image" accept="image/png,image/svg+xml,image/webp" onchange={onImage} />
				<p class="hint">{t('admin.watermarks.imageHint')}</p>
			</label>
		{/if}

		<div class="field">
			<span class="field-label">{t('admin.watermarks.position')}</span>
			<div class="positions">
				{#each WATERMARK_POSITIONS as pos (pos)}
					<label class="choice pos" title={t(`admin.watermarks.pos.${pos}` as MessageKey)}>
						<input type="radio" name="position" value={pos} bind:group={draft.position} />
						{pos === 'tile' ? t('admin.watermarks.pos.tile') : ''}
						<span class="visually-hidden">{t(`admin.watermarks.pos.${pos}` as MessageKey)}</span>
					</label>
				{/each}
			</div>
		</div>
		<div class="two">
			<label class="field">
				<span>{t('admin.watermarks.size')} ({Math.round(draft.scale * 100)}%)</span>
				<input type="range" name="scale" min="0.05" max="1" step="0.01" bind:value={draft.scale} />
			</label>
			<label class="field">
				<span>{t('admin.watermarks.opacity')} ({Math.round(draft.opacity * 100)}%)</span>
				<input type="range" name="opacity" min="0.05" max="1" step="0.01" bind:value={draft.opacity} />
			</label>
		</div>

		<div
			class="preview"
			style:justify-content={gravity[draft.position].split(' ')[0]}
			style:align-items={gravity[draft.position].split(' ')[1]}
			class:tile={draft.position === 'tile'}
		>
			{#if draft.previewSrc}
				{#if draft.position === 'tile'}
					{#each Array(6) as _, i (i)}<img src={draft.previewSrc} alt="" style:width="{draft.scale * 100}%" style:opacity={draft.opacity} />{/each}
				{:else}
					<img src={draft.previewSrc} alt="" style:width="{draft.scale * 100}%" style:opacity={draft.opacity} />
				{/if}
			{/if}
		</div>
		<p class="hint">{t('admin.watermarks.previewHint')}</p>

		<div class="row">
			<button class="btn primary" type="submit">{t('common.save')}</button>
			<button class="btn ghost" type="button" onclick={() => (draft = null)}>{t('common.cancel')}</button>
		</div>
	</form>
{:else}
	<button class="btn" type="button" onclick={() => edit(null)}><Plus size={16} />{t('admin.watermarks.new')}</button>
{/if}

<style>
	.intro {
		margin-bottom: 16px;
	}

	.list {
		list-style: none;
		margin: 0 0 16px;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 12px;
	}

	.list li {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
	}

	.list form {
		margin: 0;
	}

	.thumb {
		display: grid;
		place-items: center;
		height: 90px;
		border-radius: 6px;
		background: repeating-conic-gradient(#8a8a8a 0% 25%, #6f6f6f 0% 50%) 50% / 16px 16px;
	}

	.thumb img {
		max-width: 80%;
		max-height: 70px;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 22px 24px;
	}

	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	input[type='color'] {
		width: 56px;
		height: 40px;
		padding: 2px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--panel);
	}

	input[type='range'] {
		accent-color: var(--accent);
	}

	.positions {
		display: grid;
		grid-template-columns: repeat(3, 44px) auto;
		grid-template-rows: repeat(3, 32px);
		gap: 4px;
	}

	.pos {
		min-height: 0;
		padding: 0;
	}

	.pos:last-child {
		grid-column: 4;
		grid-row: 1 / span 3;
		padding: 0 12px;
	}

	.preview {
		position: relative;
		display: flex;
		flex-direction: column;
		aspect-ratio: 3 / 2;
		max-width: 480px;
		padding: 3%;
		border-radius: 6px;
		background: linear-gradient(135deg, #8d7b6a, #3d4b5c);
		overflow: hidden;
	}

	.preview.tile {
		flex-direction: row;
		flex-wrap: wrap;
		gap: 6%;
		align-content: space-around;
		justify-content: space-around;
	}

	.preview img {
		max-height: 90%;
		object-fit: contain;
	}

	@media (max-width: 640px) {
		.two {
			grid-template-columns: 1fr;
		}
	}
</style>
