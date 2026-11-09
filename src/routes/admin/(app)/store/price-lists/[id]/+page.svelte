<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { formatMoney, fromMinor } from '$lib/store';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data } = $props();
	const { t, lang } = useI18n();
	const categories = $derived([...new Set(data.products.map((p) => p.category))]);

	const saved: SubmitFunction = () => async ({ result, update }) => {
		await update({ reset: false });
		if (result.type === 'success') toast(t('common.saved'));
	};
</script>

<svelte:head><title>{data.list.name} · Folio</title></svelte:head>

<main class="page-wide">
	<a class="back" href="/admin/store?tab=pricelists"><ChevronLeft size={16} />{t('admin.store.tab.pricelists')}</a>
	<h1>{data.list.name}</h1>

	<form class="card block" method="POST" action="?/update" use:enhance={saved}>
		<div class="grid2">
			<label class="field"><span>{t('common.name')}</span><input name="name" value={data.list.name} required /></label>
			<label class="field">
				<span>{t('admin.priceLists.minOrder')} ({data.currency})</span>
				<input name="minOrder" inputmode="decimal" value={data.list.minOrder ? fromMinor(data.list.minOrder, data.currency) : ''} placeholder="0" />
				<p class="hint">{t('admin.priceLists.minOrderHint')}</p>
			</label>
		</div>
		<p class="hint">{t('admin.priceLists.summary', { products: data.list.products, galleries: data.list.galleries.length })}</p>
		<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
	</form>

	{#each categories as category (category)}
		<h2 class="category">{category || t('admin.products.noCategory')}</h2>
		<div class="card table-wrap">
			<table class="data">
				<tbody>
					{#each data.products.filter((p) => p.category === category) as p (p.id)}
						<tr>
							<td class="thumb">{#if p.image}<img src={p.image} alt="" />{/if}</td>
							<td><a href="/admin/store/products/{p.id}">{p.name}</a><br /><span class="hint">{t(`admin.products.kind.${p.kind}` as MessageKey)}</span></td>
							<td class="tabular">{p.from !== null ? t('store.from', { price: formatMoney(p.from, data.currency, lang) }) : t('admin.products.noPrice')}</td>
							<td class="right nowrap">
								<form class="inline" method="POST" action="?/move" use:enhance={saved}>
									<input type="hidden" name="id" value={p.id} />
									<button class="icon-btn" name="dir" value="up" aria-label={t('admin.products.up')}><ArrowUp size={14} /></button>
									<button class="icon-btn" name="dir" value="down" aria-label={t('admin.products.down')}><ArrowDown size={14} /></button>
								</form>
								<a class="btn small" href="/admin/store/products/{p.id}">{t('common.edit')}</a>
								<form
									class="inline"
									method="POST"
									action="?/deleteProduct"
									use:enhance={saved}
									onsubmit={(e) => {
										if (!confirm(t('admin.products.deleteConfirm', { name: p.name }))) e.preventDefault();
									}}
								>
									<input type="hidden" name="id" value={p.id} /><button class="btn small ghost" type="submit">{t('common.delete')}</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/each}

	<form class="card block" method="POST" action="?/addProduct">
		<h3>{t('admin.products.new')}</h3>
		<div class="grid2">
			<label class="field"><span>{t('common.name')}</span><input name="name" required maxlength="120" placeholder={t('admin.products.namePlaceholder')} /></label>
			<label class="field">
				<span>{t('admin.products.category')}</span>
				<input name="category" list="categories" maxlength="60" placeholder={t('admin.products.categoryPlaceholder')} />
				<datalist id="categories">{#each categories as c (c)}<option value={c}></option>{/each}</datalist>
			</label>
			<label class="field">
				<span>{t('admin.products.type')}</span>
				<select name="kind"><option value="physical">{t('admin.products.kind.physical')}</option><option value="digital">{t('admin.products.kind.digital')}</option></select>
			</label>
		</div>
		<div><button class="btn primary" type="submit">{t('admin.products.create')}</button></div>
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

	.category {
		font-size: 1rem;
		margin: 24px 0 10px;
	}

	.thumb {
		width: 56px;
	}

	.thumb img {
		width: 48px;
		height: 48px;
		object-fit: cover;
		border-radius: 4px;
	}

	.inline {
		display: inline-flex;
		gap: 2px;
	}

	.nowrap {
		white-space: nowrap;
	}

	.card + .card,
	form.card {
		margin-top: 16px;
	}
</style>
