<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Download from '@lucide/svelte/icons/download';
	import { countryName } from '$lib/countries';
	import { createI18n, provideI18n, type MessageKey } from '$lib/i18n';
	import { formatMoney } from '$lib/store';
	import { displayUrl } from '$lib/types';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const i18n = createI18n(data.order.language);
	provideI18n(i18n);
	const { t, lang, formatDate } = i18n;
	const order = $derived(data.order);
	const money = (amount: number) => formatMoney(amount, order.currency, lang);
	const paid = $derived(['paid', 'partially_refunded'].includes(order.paymentStatus));
	// Unpaid checkouts have no order number yet.
	const heading = $derived(order.number > 0 ? t('store.orderNumber', { number: String(order.number) }) : t('store.yourOrder'));

	// The webhook usually arrives within seconds after Stripe sends the buyer back.
	onMount(() => {
		let tries = 0;
		const timer = setInterval(() => {
			if (!data.order.waiting || ++tries > 40) return clearInterval(timer);
			void invalidateAll();
		}, 3000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>{heading}{data.storeName ? ` · ${data.storeName}` : ''}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="receipt">
	<p class="label muted">{data.storeName}</p>
	<h1>{heading}</h1>
	<p class="status">
		{#if order.waiting}
			{t('store.receipt.waiting')}
		{:else if order.status === 'cancelled'}
			{t('store.receipt.cancelled')}
		{:else}
			{t(`store.status.${order.status}` as MessageKey)} · {formatDate(order.createdAt)}
		{/if}
	</p>
	{#if paid}<p class="muted">{t('store.receipt.thanks', { email: order.email })}</p>{/if}

	<ul class="items">
		{#each data.items as item (item.id)}
			<li>
				{#if item.photo}<img src={displayUrl(item.photo, 480)} alt="" />{:else}<span class="blank"></span>{/if}
				<div class="info">
					<strong>{item.name}</strong>
					{#if item.label}<span class="muted">{item.label}</span>{/if}
					{#if item.filename}<span class="muted small">{item.filename}</span>{/if}
					{#if item.kind === 'physical'}<span class="muted small">{t('store.quantity')}: {item.quantity}</span>{/if}
					{#if item.kind === 'digital' && paid && item.files > 0}
						<div class="downloads">
							{#if item.parts > 1}
								{#each Array.from({ length: item.parts }, (_, i) => i + 1) as part (part)}
									<a class="c-btn small" href="{page.url.pathname}/download/{item.id}?part={part}" download
										><Download size={14} />{t('client.dl.part', { part, total: item.parts })}</a
									>
								{/each}
							{:else}
								<a class="c-btn small solid" href="{page.url.pathname}/download/{item.id}" download><Download size={14} />{t('client.download')}</a>
							{/if}
						</div>
					{/if}
				</div>
				<span class="tabular">{money(item.amount)}</span>
			</li>
		{/each}
	</ul>

	<dl class="totals tabular">
		<div><dt>{t('store.subtotal')}</dt><dd>{money(order.subtotal)}</dd></div>
		{#if order.discount}<div><dt>{t('store.discount')}</dt><dd>−{money(order.discount)}</dd></div>{/if}
		{#if order.shippingName}<div><dt>{t('store.shipping')} · {order.shippingName}</dt><dd>{money(order.shipping)}</dd></div>{/if}
		<div class="total"><dt>{t('store.total')}</dt><dd>{money(order.total)}</dd></div>
		{#if order.tax}<div class="muted small"><dt>{t('store.vatIncluded')}</dt><dd>{money(order.tax)}</dd></div>{/if}
		{#if order.refunded}<div><dt>{t('store.refunded')}</dt><dd>−{money(order.refunded)}</dd></div>{/if}
	</dl>

	{#if order.address}
		<section class="address">
			<h2 class="label">{t('store.deliveryAddress')}</h2>
			<p>
				{order.name}<br />{order.address.line1}{#if order.address.line2}<br />{order.address.line2}{/if}<br />{order.address.postalCode}
				{order.address.city}<br />{countryName(order.address.country, lang)}
			</p>
		</section>
	{/if}
	{#if order.tracking}<p>{t('store.tracking')}: <strong>{order.tracking}</strong></p>{/if}

	{#if order.gallerySlug}<a class="c-btn" href="/g/{order.gallerySlug}">{t('client.backToGallery')}</a>{/if}
</main>

<style>
	.receipt {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 720px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-5);
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: var(--display-weight);
		font-size: clamp(1.75rem, 4vw, 2.5rem);
	}

	.status {
		margin: 0;
		font-size: 1.0625rem;
	}

	.muted {
		margin: 0;
		color: var(--color-text-muted);
	}

	.small {
		font-size: 0.8125rem;
	}

	.items {
		display: flex;
		flex-direction: column;
		margin: var(--space-4) 0 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--color-border);
	}

	.items li {
		display: grid;
		grid-template-columns: 72px 1fr auto;
		gap: var(--space-4);
		align-items: start;
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.items img,
	.blank {
		width: 72px;
		height: 72px;
		object-fit: cover;
		background: var(--color-surface);
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.downloads {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.totals {
		margin: 0;
	}

	.totals div {
		display: flex;
		justify-content: space-between;
		padding: 4px 0;
	}

	.totals dt,
	.totals dd {
		margin: 0;
	}

	.totals .total {
		font-weight: 600;
		font-size: 1.125rem;
	}

	.address h2 {
		margin: var(--space-4) 0 var(--space-2);
	}

	.address p {
		margin: 0;
		line-height: 1.6;
	}

	a.c-btn {
		align-self: flex-start;
		margin-top: var(--space-4);
	}
</style>
