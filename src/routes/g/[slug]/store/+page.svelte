<script lang="ts">
	import { getGalleryState } from '$lib/components/client/gallery-state.svelte';
	import { useI18n } from '$lib/i18n';
	import { formatMoney, fromPrice, richText, type ProductData } from '$lib/store';

	let { data } = $props();
	const { t, lang } = useI18n();
	const gs = getGalleryState();
	let open = $state<string | null>(null);

	const products = $derived(data.store?.products ?? []);
	const categories = $derived([...new Set(products.map((p) => p.category))]);
	const needsPhoto = (p: ProductData) => !p.noPhoto && !(p.kind === 'digital' && p.digital?.scope === 'gallery');
</script>

{#if data.state === 'open'}
	<h1 class="title label">{t('store.shop')}</h1>
	{#if !data.store}
		<p class="empty">{t('store.closed')}</p>
	{:else}
		{#each categories as category (category)}
			<section class="category">
				{#if category}<h2 class="label">{category}</h2>{/if}
				<ul class="grid">
					{#each products.filter((p) => p.category === category) as p (p.id)}
						<li class="card">
							<button type="button" class="head" onclick={() => (open = open === p.id ? null : p.id)} aria-expanded={open === p.id}>
								{#if p.images[0]}<img src={p.images[0]} alt="" loading="lazy" />{:else}<span class="placeholder"></span>{/if}
								<span class="name">{p.name}</span>
								<span class="price">{t('store.from', { price: formatMoney(fromPrice(p) ?? 0, data.store.currency, lang) })}</span>
							</button>
							{#if open === p.id}
								<div class="more">
									{#if p.images.length > 1}
										<div class="images">{#each p.images.slice(1) as src (src)}<img {src} alt="" loading="lazy" />{/each}</div>
									{/if}
									{#if p.description}<div class="desc">{@html richText(p.description)}</div>{/if}
									{#if needsPhoto(p)}
										<p class="hint">{t('store.pickPhoto')}</p>
										<a class="c-btn small" href="/g/{data.gallery.slug}">{t('client.backToGallery')}</a>
									{:else}
										<button class="c-btn small solid" type="button" onclick={() => (gs.buy = { photo: null, photos: [], productId: p.id })}>{t('store.addToCart')}</button>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
{/if}

<style>
	.title {
		margin: var(--space-3) 0 var(--space-5);
		color: var(--color-text-muted);
	}

	.empty {
		padding: var(--space-8) 0;
		text-align: center;
		color: var(--color-text-muted);
	}

	.category {
		margin-bottom: var(--space-7);
	}

	.category h2 {
		margin: 0 0 var(--space-4);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
		gap: var(--space-6) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
	}

	.head img,
	.placeholder {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		background: var(--color-surface);
	}

	.name {
		font-family: var(--font-display);
		font-size: 1.125rem;
	}

	.price,
	.hint {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.more {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
	}

	.images {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
		width: 100%;
	}

	.images img {
		aspect-ratio: 1;
		object-fit: cover;
	}

	.desc :global(p) {
		margin: 0 0 var(--space-2);
	}
</style>
