<script lang="ts">
	import { enhance } from '$app/forms';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import FileDown from '@lucide/svelte/icons/file-down';
	import { countryName } from '$lib/countries';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { formatMoney, fromMinor, ORDER_STATUSES } from '$lib/store';
	import { displayUrl } from '$lib/types';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';

	let { data, form } = $props();
	const { t, lang } = useI18n();
	const o = $derived(data.order);
	const money = (amount: number) => formatMoney(amount, o.currency, lang);
	const dateTime = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
	const refundable = $derived(o.total - o.refunded);

	const done = async ({ result, update }: { result: ActionResult; update: (options?: { reset?: boolean }) => Promise<void> }) => {
		await update({ reset: false });
		if (result.type === 'success') toast(t('common.saved'));
		else toast(t('common.error'), 'error');
	};
	const saved: SubmitFunction = () => done;
</script>

<svelte:head><title>#{o.number} · Folio</title></svelte:head>

<main class="page-wide">
	<a class="back" href="/admin/store?tab=orders"><ChevronLeft size={16} />{t('admin.store.tab.orders')}</a>
	<div class="row between">
		<h1>{t('store.orderNumber', { number: String(o.number) })}</h1>
		{#if data.hasPrint}<a class="btn" href="/admin/store/orders/{o.id}/print"><FileDown size={14} />{t('admin.orders.printZip')}</a>{/if}
	</div>
	<p class="hint">
		{dateTime.format(o.createdAt)} · {t(`store.payment.${o.paymentStatus}` as MessageKey)}
		{#if o.stripeMode} · {t(`admin.orders.mode.${o.stripeMode}` as MessageKey)}{/if}
		{#if o.stripePaymentIntent} · <code>{o.stripePaymentIntent}</code>{/if}
	</p>

	<div class="layout">
		<div class="stack">
			<section class="card block">
				<h3>{t('admin.orders.items')}</h3>
				<ul class="items">
					{#each data.items as item (item.id)}
						<li>
							<span class="thumb">
								{#if item.photo}
									<img src={displayUrl(item.photo, 480)} alt="" />
									{#if item.crop}
										<span class="crop" style:left="{item.crop.x * 100}%" style:top="{item.crop.y * 100}%" style:width="{item.crop.w * 100}%" style:height="{item.crop.h * 100}%"></span>
									{/if}
								{/if}
							</span>
							<div class="info">
								<strong>{item.productName}</strong>
								{#if item.variantLabel}<span>{item.variantLabel}</span>{/if}
								{#if item.filename}<span class="hint">{item.filename}</span>{/if}
								<span class="hint">{t(`admin.products.kind.${item.kind}` as MessageKey)}{#if item.digital} · {t(`admin.products.scope.${item.digital.scope}` as MessageKey)}{/if} · {t('store.quantity')}: {item.quantity}</span>
								{#if item.photo}
									<a class="btn small item-dl" href="/admin/store/orders/{o.id}/item/{item.id}" download>
										<FileDown size={14} />{item.crop ? t('admin.orders.downloadCropped') : t('admin.lists.downloadOriginal')}
									</a>
								{/if}
							</div>
							<span class="tabular right">{money(item.unitPrice * item.quantity - item.discount)}{#if item.taxRate}<br /><span class="hint">{t('admin.orders.vatRate', { rate: (item.taxRate / 100).toLocaleString(lang) })}</span>{/if}</span>
						</li>
					{/each}
				</ul>
				<dl class="totals tabular">
					<div><dt>{t('store.subtotal')}</dt><dd>{money(o.subtotal)}</dd></div>
					{#if o.discount}<div><dt>{t('store.discount')}{#if o.couponCode} ({o.couponCode}){/if}</dt><dd>−{money(o.discount)}</dd></div>{/if}
					{#if o.shippingName}<div><dt>{t('store.shipping')} · {o.shippingName}</dt><dd>{money(o.shipping)}</dd></div>{/if}
					<div class="total"><dt>{t('store.total')}</dt><dd>{money(o.total)}</dd></div>
					<div class="hint"><dt>{t('store.vatIncluded')}</dt><dd>{money(o.tax)}</dd></div>
					{#if o.refunded}<div><dt>{t('store.refunded')}</dt><dd>−{money(o.refunded)}</dd></div>{/if}
				</dl>
			</section>

			<form class="card block" method="POST" action="?/notes" use:enhance={saved}>
				<h3>{t('admin.orders.notes')}</h3>
				<textarea name="notes" rows="4" placeholder={t('admin.orders.notesHint')}>{o.notes}</textarea>
				<div><button class="btn" type="submit">{t('common.save')}</button></div>
			</form>
		</div>

		<div class="stack">
			<section class="card block">
				<h3>{t('admin.orders.customer')}</h3>
				<p>{o.name}<br /><a href="mailto:{o.email}">{o.email}</a>{#if o.phone}<br />{o.phone}{/if}</p>
				{#if o.address}
					<p>{o.address.line1}{#if o.address.line2}<br />{o.address.line2}{/if}<br />{o.address.postalCode} {o.address.city}<br />{countryName(o.address.country, lang)}</p>
				{:else if o.country}
					<p class="hint">{countryName(o.country, lang)}</p>
				{/if}
				{#if o.galleryId}<a href="/admin/galleries/{o.galleryId}?tab=activity">{o.galleryName}</a>{:else}<span class="hint">{o.galleryName}</span>{/if}
			</section>

			<form class="card block" method="POST" action="?/status" use:enhance={saved}>
				<h3>{t('admin.orders.status')}</h3>
				<select name="status" value={o.status}>
					{#each ORDER_STATUSES as s (s)}<option value={s}>{t(`store.status.${s}` as MessageKey)}</option>{/each}
				</select>
				<div><button class="btn" type="submit">{t('common.save')}</button></div>
			</form>

			{#if o.kind !== 'digital'}
				<form class="card block" method="POST" action="?/ship" use:enhance={saved}>
					<h3>{t('admin.orders.ship')}</h3>
					<input name="tracking" value={o.tracking ?? ''} placeholder={t('store.tracking')} aria-label={t('store.tracking')} />
					<p class="hint">{t('admin.orders.shipHint')}</p>
					<div><button class="btn primary" type="submit">{t('admin.orders.markShipped')}</button></div>
				</form>
			{/if}

			{#if refundable > 0 && ['paid', 'partially_refunded'].includes(o.paymentStatus)}
				<form
					class="card block"
					method="POST"
					action="?/refund"
					use:enhance={({ cancel }) => {
						if (!confirm(t('admin.orders.refundConfirm'))) cancel();
						return done;
					}}
				>
					<h3>{t('admin.orders.refund')}</h3>
					<input name="amount" inputmode="decimal" value={fromMinor(refundable, o.currency)} aria-label={t('admin.orders.refundAmount')} />
					<p class="hint">{t('admin.orders.refundHint', { max: money(refundable) })}</p>
					{#if form?.refundError}<p class="error-text">{form.refundError}</p>{/if}
					<div><button class="btn danger" type="submit">{t('admin.orders.refund')}</button></div>
				</form>
			{/if}
		</div>
	</div>
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

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
		gap: 20px;
		align-items: start;
		margin-top: 16px;
	}

	.items {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.items li {
		display: grid;
		grid-template-columns: 96px 1fr auto;
		gap: 14px;
		align-items: start;
	}

	.thumb {
		position: relative;
		display: block;
		width: 96px;
	}

	.thumb img {
		width: 96px;
		height: auto;
		border-radius: 4px;
	}

	.crop {
		position: absolute;
		border: 2px solid #fff;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.item-dl {
		align-self: flex-start;
		margin-top: 6px;
	}

	.totals {
		margin: 8px 0 0;
		border-top: 1px solid var(--line);
		padding-top: 8px;
	}

	.totals div {
		display: flex;
		justify-content: space-between;
		padding: 3px 0;
	}

	.totals dt,
	.totals dd {
		margin: 0;
	}

	.total {
		font-weight: 600;
	}

	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
