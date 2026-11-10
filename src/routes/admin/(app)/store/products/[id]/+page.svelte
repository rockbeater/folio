<script lang="ts">
	import { enhance } from '$app/forms';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { fromMinor, richText, syncVariants, toMinor, variantLabel, type ProductOption, type Variant } from '$lib/store';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data, form } = $props();
	const { t } = useI18n();
	// svelte-ignore state_referenced_locally
	const p = data.product;
	// svelte-ignore state_referenced_locally
	const currency = data.currency;

	let kind = $state(p.kind);
	let options = $state<ProductOption[]>(structuredClone(p.options));
	// Prices in the matrix are edited as text and stored in minor units.
	let prices = $state<Record<string, { price: string; extra: string; visible: boolean }>>(
		Object.fromEntries(p.variants.map((v) => [v.key, { price: fromMinor(v.price, currency), extra: v.extraShipping ? fromMinor(v.extraShipping, currency) : '', visible: v.visible }]))
	);
	let defaultPrice = $state(p.price ? fromMinor(p.price, currency) : '');
	let filter = $state<'all' | 'visible' | 'hidden'>('all');
	let removed = $state<string[]>([]);
	let description = $state(p.description);
	// Bound fields: plain value={…} inputs would be reset when the option matrix re-renders.
	let name = $state(p.name);
	let category = $state(p.category);
	let extraShipping = $state(p.extraShipping ? fromMinor(p.extraShipping, currency) : '');
	let preview = $state(false);

	const matrix = $derived(syncVariants(options.filter((o) => o.name.trim() && o.values.some((v) => v.name.trim())), [], 0));
	const rows = $derived(
		matrix
			.map((v) => ({ key: v.key, label: variantLabel({ options }, v.key), ...(prices[v.key] ?? { price: defaultPrice, extra: '', visible: true }) }))
			.filter((r) => filter === 'all' || (filter === 'visible' ? r.visible : !r.visible))
	);
	const variantsJson = $derived(
		JSON.stringify(
			matrix.map((v): Variant => {
				const r = prices[v.key] ?? { price: defaultPrice, extra: '', visible: true };
				return { key: v.key, price: toMinor(r.price, currency), extraShipping: toMinor(r.extra, currency), visible: r.visible };
			})
		)
	);

	// New combinations start with the default price.
	$effect(() => {
		for (const v of matrix) if (!prices[v.key]) prices[v.key] = { price: defaultPrice, extra: '', visible: true };
	});

	const id = () => crypto.randomUUID().slice(0, 8);
	function addOption() {
		options.push({ id: id(), name: '', values: [{ id: id(), name: '' }] });
	}

	// Drag and drop to sort options and values.
	let dragging: { option: number; value: number | null } | null = null;
	function drop(option: number, value: number | null) {
		if (!dragging) return;
		if (value === null && dragging.value === null) {
			const [moved] = options.splice(dragging.option, 1);
			options.splice(option, 0, moved);
		} else if (value !== null && dragging.value !== null && dragging.option === option) {
			const list = options[option].values;
			const [moved] = list.splice(dragging.value, 1);
			list.splice(value, 0, moved);
		}
		dragging = null;
	}

	const saved: SubmitFunction = () => async ({ result, update }) => {
		await update({ reset: false });
		if (result.type === 'success') {
			toast(t('common.saved'));
			removed = [];
		} else toast(t('common.error'), 'error');
	};
</script>

<svelte:head><title>{p.name} · Folio</title></svelte:head>

<main class="page-wide">
	<a class="back" href="/admin/store/price-lists/{data.list.id}"><ChevronLeft size={16} />{data.list.name}</a>
	<h1>{p.name}</h1>

	<form class="stack" method="POST" action="?/save" enctype="multipart/form-data" use:enhance={saved}>
		<section class="card block">
			<div class="grid2">
				<label class="field"><span>{t('common.name')}</span><input name="name" bind:value={name} required maxlength="120" /></label>
				<label class="field">
					<span>{t('admin.products.category')}</span>
					<input name="category" bind:value={category} list="categories" maxlength="60" />
					<datalist id="categories">{#each data.categories as c (c)}<option value={c}></option>{/each}</datalist>
				</label>
				<label class="field">
					<span>{t('admin.products.type')}</span>
					<select name="kind" bind:value={kind}>
						<option value="physical">{t('admin.products.kind.physical')}</option>
						<option value="digital">{t('admin.products.kind.digital')}</option>
					</select>
				</label>
			</div>
			{#if kind === 'digital'}
				<div class="grid2">
					<label class="field">
						<span>{t('admin.products.scope')}</span>
						<select name="scope" value={p.digital?.scope ?? 'photo'}>
							<option value="photo">{t('admin.products.scope.photo')}</option>
							<option value="section">{t('admin.products.scope.section')}</option>
							<option value="gallery">{t('admin.products.scope.gallery')}</option>
						</select>
					</label>
					<label class="field">
						<span>{t('admin.products.size')}</span>
						<select name="size" value={p.digital?.size ?? 'highres'}>
							<option value="highres">{t('admin.settings.highRes')}</option>
							<option value="web">{t('admin.settings.web')}</option>
						</select>
					</label>
				</div>
				<p class="hint">{t('admin.products.digitalHint')}</p>
			{/if}

			<label class="field">
				<span>{t('admin.products.description')}</span>
				<textarea name="description" rows="5" bind:value={description}></textarea>
				<p class="hint">{t('admin.storeSettings.formatting')} <button class="link" type="button" onclick={() => (preview = !preview)}>{t('admin.editor.preview')}</button></p>
				{#if preview}<div class="preview">{@html richText(description)}</div>{/if}
			</label>
		</section>

		<section class="card block">
			<h3>{t('admin.products.images')}</h3>
			<div class="images">
				{#each p.images.filter((img) => !removed.includes(img)) as img (img)}
					<figure>
						<img src="/store-images/{img}" alt="" />
						<button class="icon-btn" type="button" onclick={() => removed.push(img)} aria-label={t('common.delete')}><X size={14} /></button>
					</figure>
				{/each}
			</div>
			{#each removed as img (img)}<input type="hidden" name="removeImage" value={img} />{/each}
			<input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple />
			<p class="hint">{t('admin.products.imagesHint')}</p>
			{#if form?.error === 'image'}<p class="error-text">{t('admin.studio.fileInvalid')}</p>{/if}
		</section>

		{#if kind === 'physical'}
			<section class="card block">
				<div class="row between">
					<h3>{t('admin.products.options')}</h3>
					<button class="btn small" type="button" onclick={addOption}><Plus size={14} />{t('admin.products.addOption')}</button>
				</div>
				<p class="hint">{t('admin.products.optionsHint')}</p>
				{#each options as option, oi (option.id)}
					<div
						class="option"
						role="listitem"
						draggable="true"
						ondragstart={() => (dragging = { option: oi, value: null })}
						ondragover={(e) => e.preventDefault()}
						ondrop={() => drop(oi, null)}
					>
						<div class="row nowrap">
							<GripVertical size={16} class="grip" />
							<input bind:value={option.name} placeholder={t('admin.products.optionName')} aria-label={t('admin.products.optionName')} />
							<button class="icon-btn" type="button" onclick={() => options.splice(oi, 1)} aria-label={t('common.delete')}><X size={14} /></button>
						</div>
						<div class="values">
							{#each option.values as value, vi (value.id)}
								<span
									class="value"
									role="listitem"
									draggable="true"
									ondragstart={(e) => {
										e.stopPropagation();
										dragging = { option: oi, value: vi };
									}}
									ondragover={(e) => e.preventDefault()}
									ondrop={(e) => {
										e.stopPropagation();
										drop(oi, vi);
									}}
								>
									<input bind:value={value.name} placeholder={t('admin.products.valueName')} aria-label={t('admin.products.valueName')} />
									<button class="icon-btn" type="button" onclick={() => option.values.splice(vi, 1)} aria-label={t('common.delete')}><X size={12} /></button>
								</span>
							{/each}
							<button class="btn small ghost" type="button" onclick={() => option.values.push({ id: id(), name: '' })}><Plus size={12} />{t('admin.products.addValue')}</button>
						</div>
					</div>
				{/each}
				<input type="hidden" name="options" value={JSON.stringify(options)} />
				<input type="hidden" name="variants" value={variantsJson} />

				{#if matrix.length > 0}
					<div class="row between">
						<h3>{t('admin.products.matrix', { count: matrix.length })}</h3>
						<div class="segmented">
							{#each ['all', 'visible', 'hidden'] as const as f (f)}
								<label class="choice"><input type="radio" bind:group={filter} value={f} />{t(`admin.products.filter.${f}` as MessageKey)}</label>
							{/each}
						</div>
					</div>
					<label class="field narrow">
						<span>{t('admin.products.defaultPrice')} ({currency})</span>
						<input inputmode="decimal" bind:value={defaultPrice} />
					</label>
					<div class="table-wrap">
						<table class="data">
							<thead><tr><th>{t('admin.products.variant')}</th><th>{t('admin.products.price')} ({currency})</th><th>{t('admin.products.extraShipping')}</th><th>{t('admin.products.visible')}</th></tr></thead>
							<tbody>
								{#each rows as r (r.key)}
									{#if prices[r.key]}
									<tr>
										<td>{r.label}</td>
										<td><input class="money" inputmode="decimal" bind:value={prices[r.key].price} aria-label={t('admin.products.price')} /></td>
										<td><input class="money" inputmode="decimal" bind:value={prices[r.key].extra} aria-label={t('admin.products.extraShipping')} placeholder="0" /></td>
										<td><input type="checkbox" bind:checked={prices[r.key].visible} aria-label={t('admin.products.visible')} /></td>
									</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>
		{/if}

		{#if kind === 'digital' || matrix.length === 0}
			<section class="card block">
				<div class="grid2">
					<label class="field"><span>{t('admin.products.price')} ({currency})</span><input name="price" inputmode="decimal" bind:value={defaultPrice} required /></label>
					{#if kind === 'physical'}
						<label class="field"><span>{t('admin.products.extraShipping')} ({currency})</span><input name="extraShipping" inputmode="decimal" bind:value={extraShipping} placeholder="0" /></label>
					{/if}
				</div>
			</section>
		{:else}
			<input type="hidden" name="price" value={defaultPrice} />
		{/if}

		<section class="card block">
			{#if kind === 'physical'}
				<label class="switch"><input type="checkbox" name="noPhoto" checked={p.noPhoto} /><span>{t('admin.products.noPhoto')}</span></label>
			{/if}
			<label class="switch"><input type="checkbox" name="multiPhoto" checked={p.multiPhoto} /><span>{t('admin.products.multiPhoto')}</span></label>
			<label class="switch"><input type="checkbox" name="maxOne" checked={p.maxOne} /><span>{t('admin.products.maxOne')}</span></label>
			<label class="switch"><input type="checkbox" name="taxExempt" checked={p.taxExempt} /><span>{t('admin.products.taxExempt')}</span></label>
		</section>

		<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
	</form>
</main>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--muted);
		text-decoration: none;
		margin-bottom: 8px;
	}

	.between {
		justify-content: space-between;
		align-items: center;
	}

	h3 {
		font-size: 1rem;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.preview {
		padding: 12px 14px;
		border: 1px dashed var(--line);
		border-radius: var(--radius);
	}

	.images {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.images figure {
		position: relative;
		margin: 0;
	}

	.images img {
		width: 96px;
		height: 96px;
		object-fit: cover;
		border-radius: 6px;
	}

	.images .icon-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		background: var(--surface, #fff);
	}

	.option {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		cursor: grab;
	}

	.values {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding-left: 24px;
	}

	.value {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		cursor: grab;
	}

	.value input {
		width: 120px;
	}

	.narrow {
		max-width: 220px;
	}

	.money {
		width: 110px;
	}
</style>
