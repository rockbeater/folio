<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { formatMoney, fromPrice, priceOf, richText, variantKey, visibleVariants, type ProductData } from '$lib/store';
	import { displayUrl, type PhotoView } from '$lib/types';
	import { getGalleryState } from './gallery-state.svelte';

	let { products, currency }: { products: ProductData[]; currency: string } = $props();
	const { t, lang } = useI18n();
	const gs = getGalleryState();
	// svelte-ignore state_referenced_locally
	const request = gs.buy!;
	const money = (amount: number) => formatMoney(amount, currency, lang);

	const needsPhoto = (p: ProductData) => !p.noPhoto && !(p.kind === 'digital' && p.digital?.scope === 'gallery');
	// svelte-ignore state_referenced_locally
	const choices = products.filter((p) => (request.photo ? needsPhoto(p) : !needsPhoto(p)));
	const categories = [...new Set(choices.map((p) => p.category))];

	// svelte-ignore state_referenced_locally
	let product = $state<ProductData | null>(choices.find((p) => p.id === request.productId) ?? (choices.length === 1 ? choices[0] : null));
	let values = $state<string[]>([]);
	let quantity = $state(1);
	let busy = $state(false);
	const extra = $state<string[]>([]);

	$effect(() => {
		// Start with the first combination the buyer can choose.
		const first = product ? visibleVariants(product)[0] : undefined;
		values = first ? first.key.split('|') : [];
		quantity = 1;
	});

	const key = $derived(product && product.options.length ? variantKey(values) : '');
	const price = $derived(product ? priceOf(product, key) : null);
	const canQuantity = $derived(Boolean(product && product.kind === 'physical' && !product.maxOne));
	const photoCount = $derived(request.photo ? 1 + extra.length : 0);

	function toggleExtra(id: string) {
		const i = extra.indexOf(id);
		if (i >= 0) extra.splice(i, 1);
		else extra.push(id);
	}

	async function add() {
		if (!product || !price) return;
		busy = true;
		const res = await fetch(`/g/${gs.slug}/api/cart`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				action: 'add',
				productId: product.id,
				variantKey: key,
				photoIds: request.photo ? [request.photo.id, ...extra] : [],
				quantity
			})
		}).catch(() => null);
		busy = false;
		if (!res?.ok) {
			toast(t('common.error'), 'error');
			return;
		}
		const view = (await res.json()) as { count: number; cropsMissing: number };
		gs.cartCount = view.count;
		toast(view.cropsMissing > 0 ? t('store.addedChooseCrop') : t('store.added'), 'info', view.cropsMissing > 0 ? 7000 : 4000);
		gs.buy = null;
	}
</script>

<Modal title={t('store.buy')} onclose={() => (gs.buy = null)} wide>
	<div class="buy">
		{#if request.photo}
			<img class="photo" src={displayUrl(request.photo, 480)} alt="" style:background-color={request.photo.color} />
		{/if}

		{#if !product}
			{#if choices.length === 0}
				<p class="muted">{t('store.noProducts')}</p>
			{/if}
			{#each categories as category (category)}
				<section class="group">
					{#if category}<h3 class="label">{category}</h3>{/if}
					<ul class="products">
						{#each choices.filter((p) => p.category === category) as p (p.id)}
							<li>
								<button type="button" class="product" onclick={() => (product = p)}>
									{#if p.images[0]}<img src={p.images[0]} alt="" />{:else}<span class="placeholder"></span>{/if}
									<span class="name">{p.name}</span>
									<span class="muted">{t('store.from', { price: money(fromPrice(p) ?? 0) })}</span>
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		{:else}
			<div class="detail">
				{#if choices.length > 1}
					<button class="back c-btn small ghost" type="button" onclick={() => (product = null)}><ChevronLeft size={16} />{t('store.allProducts')}</button>
				{/if}
				<h3 class="title">{product.name}</h3>
				{#if product.description}<div class="desc">{@html richText(product.description)}</div>{/if}

				{#each product.options as option, i (option.id)}
					<label class="field">
						<span class="label">{option.name}</span>
						<select class="c-input" bind:value={values[i]}>
							{#each option.values as value (value.id)}<option value={value.id}>{value.name}</option>{/each}
						</select>
					</label>
				{/each}

				{#if canQuantity}
					<label class="field qty">
						<span class="label">{t('store.quantity')}</span>
						<input class="c-input" type="number" min="1" max="99" bind:value={quantity} />
					</label>
				{/if}

				{#if product.multiPhoto && request.photo && request.photos.length > 1}
					<details class="more">
						<summary>{t('store.morePhotos', { count: photoCount })}</summary>
						<ul class="thumbs">
							{#each request.photos.filter((p) => p.id !== request.photo?.id) as p (p.id)}
								<li>
									<button type="button" class:on={extra.includes(p.id)} onclick={() => toggleExtra(p.id)} aria-pressed={extra.includes(p.id)} aria-label={p.filename}>
										<img src={displayUrl(p, 480)} alt="" loading="lazy" />
										{#if extra.includes(p.id)}<span class="tick"><Check size={14} strokeWidth={3} /></span>{/if}
									</button>
								</li>
							{/each}
						</ul>
					</details>
				{/if}

				<div class="footer">
					<span class="price tabular">
						{#if price}{money(price.price * (canQuantity ? quantity || 1 : 1) * Math.max(1, photoCount))}{:else}{t('store.unavailable')}{/if}
					</span>
					<button class="c-btn solid" type="button" disabled={!price || busy} onclick={add}>{t('store.addToCart')}</button>
				</div>
			</div>
		{/if}
	</div>
</Modal>

<style>
	.buy {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.photo {
		max-height: 180px;
		width: auto;
		align-self: center;
	}

	.muted {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.group h3 {
		margin: 0 0 var(--space-3);
		color: var(--color-text-muted);
	}

	.products {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.product {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
	}

	.product img,
	.placeholder {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		background: var(--color-surface);
	}

	.name {
		font-weight: 500;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.back {
		align-self: flex-start;
		padding-left: 0;
	}

	.title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.375rem;
	}

	.desc {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
	}

	.desc :global(p) {
		margin: 0 0 var(--space-2);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.qty {
		max-width: 140px;
	}

	.more summary {
		cursor: pointer;
	}

	.thumbs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
		gap: 6px;
		margin: var(--space-3) 0 0;
		padding: 0;
		list-style: none;
		max-height: 260px;
		overflow-y: auto;
	}

	.thumbs button {
		position: relative;
		width: 100%;
		padding: 0;
		border: 2px solid transparent;
		background: none;
	}

	.thumbs button.on {
		border-color: var(--color-text);
	}

	.thumbs img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
	}

	.tick {
		position: absolute;
		top: 4px;
		right: 4px;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--color-text);
		color: var(--color-bg);
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border);
	}

	.price {
		font-size: 1.25rem;
	}
</style>
