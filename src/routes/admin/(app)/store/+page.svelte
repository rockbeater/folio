<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash-2';
	import Modal from '$lib/components/Modal.svelte';
	import CarriersEditor from '$lib/components/admin/CarriersEditor.svelte';
	import { COUNTRY_CODES, countryName, countryOptions } from '$lib/countries';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { formatMoney, fromMinor, ORDER_STATUSES } from '$lib/store';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data, form } = $props();
	const { t, lang } = useI18n();

	const TABS = ['orders', 'customers', 'pricelists', 'coupons', 'taxes', 'shipping', 'report', 'settings'] as const;
	const money = (amount: number, currency = data.currency) => formatMoney(amount, currency, lang);
	const dateTime = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' });
	const countries = countryOptions(COUNTRY_CODES, lang);

	const saved: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') toast(t('common.saved'));
			else if (result.type === 'failure') toast(t('common.error'), 'error');
		};
	};

	function confirmSubmit(text: string) {
		return (event: SubmitEvent) => {
			if (!confirm(text)) event.preventDefault();
		};
	}

	// Coupons
	type CouponRow = NonNullable<typeof data.coupons>[number];
	let couponTab = $state<'active' | 'scheduled' | 'inactive'>('active');
	let editingCoupon = $state<Partial<CouponRow> | null>(null);
	const today = new Date().toLocaleDateString('sv-SE');

	function newCoupon() {
		editingCoupon = { startsOn: today, active: true, freeShipping: false, oncePerGallery: false, banner: false };
	}

	const exportQuery = $derived(page.url.searchParams.toString());

	function pageHref(p: number): string {
		const q = new URLSearchParams(page.url.searchParams);
		q.set('page', String(p));
		return `?${q}`;
	}
</script>

<svelte:head><title>{t('admin.store.title')} · Folio</title></svelte:head>

<main class="page-wide">
	<div class="head">
		<h1>{t('admin.store.title')}</h1>
		<span class="badge" class:on={data.enabled}>{data.enabled ? t('admin.store.open') : t('admin.store.closedBadge')}</span>
	</div>
	{#if data.problems.length > 0}
		<div class="alert error problems">
			<p><strong>{t('admin.store.problemsTitle')}</strong></p>
			<ul>
				{#each data.problems as problem (problem)}<li>{t(`admin.store.problem.${problem}` as MessageKey)}</li>{/each}
			</ul>
		</div>
	{/if}
	<nav class="tabs">
		{#each TABS as item (item)}
			<a href="?tab={item}" aria-current={data.tab === item ? 'page' : undefined} data-sveltekit-noscroll>{t(`admin.store.tab.${item}` as MessageKey)}</a>
		{/each}
	</nav>

	{#if data.tab === 'orders' && data.orders}
		<form class="filters card" method="GET">
			<input type="hidden" name="tab" value="orders" />
			<input name="number" value={data.filter.number} placeholder={t('admin.orders.number')} aria-label={t('admin.orders.number')} />
			<select name="status" value={data.filter.status} aria-label={t('admin.orders.status')}>
				<option value="">{t('admin.orders.allStatuses')}</option>
				{#each ORDER_STATUSES as s (s)}<option value={s}>{t(`store.status.${s}` as MessageKey)}</option>{/each}
			</select>
			<input name="customer" value={data.filter.customer} placeholder={t('admin.orders.customer')} aria-label={t('admin.orders.customer')} />
			<input name="gallery" value={data.filter.gallery} placeholder={t('admin.orders.gallery')} aria-label={t('admin.orders.gallery')} />
			<select name="kind" value={data.filter.kind} aria-label={t('admin.orders.type')}>
				<option value="">{t('admin.orders.allTypes')}</option>
				{#each ['physical', 'digital', 'mixed'] as k (k)}<option value={k}>{t(`admin.orders.kind.${k}` as MessageKey)}</option>{/each}
			</select>
			<div class="filter-actions">
				<button class="btn" type="submit">{t('admin.dashboard.search')}</button>
				<a class="btn ghost" href="/admin/store/export/orders?{exportQuery}">CSV</a>
			</div>
		</form>
		{#if data.orders.rows.length === 0}
			<p class="hint">{t('admin.orders.none')}</p>
		{:else}
			<div class="card table-wrap">
				<table class="data">
					<thead>
						<tr>
							<th>{t('admin.orders.number')}</th>
							<th>{t('admin.orders.status')}</th>
							<th>{t('admin.orders.customer')}</th>
							<th>{t('admin.orders.gallery')}</th>
							<th>{t('admin.orders.type')}</th>
							<th>{t('admin.activity.when')}</th>
							<th class="right">{t('store.total')}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each data.orders.rows as o (o.id)}
							<tr>
								<td><a href="/admin/store/orders/{o.id}">#{o.number}</a>{#if o.simulated} <span class="badge">{t('admin.orders.simulated')}</span>{/if}</td>
								<td><span class="badge" class:on={o.status === 'processing'}>{t(`store.status.${o.status}` as MessageKey)}</span></td>
								<td>{o.name}<br /><span class="hint">{o.email}</span></td>
								<td>{o.galleryName}</td>
								<td>{t(`admin.orders.kind.${o.kind}` as MessageKey)}</td>
								<td>{dateTime.format(o.createdAt)}</td>
								<td class="right tabular">{money(o.total, o.currency)}</td>
								<td class="right">
									<form method="POST" action="?/deleteOrder" use:enhance={saved} onsubmit={confirmSubmit(t('admin.orders.deleteConfirm', { number: String(o.number) }))}>
										<input type="hidden" name="id" value={o.id} />
										<button class="icon-btn" type="submit" title={t('admin.orders.delete')} aria-label={t('admin.orders.delete')}><Trash size={14} /></button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if data.orders.pages > 1}
				<nav class="pager">
					{#each Array.from({ length: data.orders.pages }, (_, i) => i + 1) as p (p)}
						<a href={pageHref(p)} aria-current={p === data.orders.page ? 'page' : undefined}>{p}</a>
					{/each}
				</nav>
			{/if}
		{/if}
	{:else if data.tab === 'customers' && data.customers}
		<div class="row between">
			<p class="hint">{t('admin.customers.intro')}</p>
			<a class="btn ghost" href="/admin/store/export/customers">CSV</a>
		</div>
		{#if data.customers.length === 0}
			<p class="hint">{t('admin.customers.none')}</p>
		{:else}
			<div class="card table-wrap">
				<table class="data">
					<thead>
						<tr><th>{t('common.name')}</th><th>{t('common.email')}</th><th>{t('admin.customers.orders')}</th><th class="right">{t('admin.customers.spent')}</th><th>{t('admin.customers.last')}</th></tr>
					</thead>
					<tbody>
						{#each data.customers as c (c.email)}
							<tr>
								<td><a href="?tab=customers&customer={encodeURIComponent(c.email)}">{c.name}</a></td>
								<td>{c.email}</td>
								<td class="tabular">{c.orders}</td>
								<td class="right tabular">{money(c.spent, c.currency)}</td>
								<td>{dateTime.format(c.lastOrder)}</td>
							</tr>
							{#if data.customer === c.email}
								<tr>
									<td colspan="5">
										<ul class="history">
											{#each data.history as o (o.id)}
												<li>
													<a href="/admin/store/orders/{o.id}">#{o.number}</a> · {dateTime.format(o.createdAt)} · {o.galleryName} · {t(`store.status.${o.status}` as MessageKey)} ·
													<span class="tabular">{money(o.total, o.currency)}</span>
												</li>
											{/each}
										</ul>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else if data.tab === 'pricelists' && data.priceLists}
		<p class="hint">{t('admin.priceLists.intro')}</p>
		<div class="stack">
			{#each data.priceLists as list (list.id)}
				<div class="card block">
					<div class="row between">
						<div>
							<a class="title" href="/admin/store/price-lists/{list.id}">{list.name}</a>
							{#if list.isDefault}<span class="badge on">{t('admin.templates.default')}</span>{/if}
							<p class="hint">
								{t('admin.priceLists.summary', { products: list.products, galleries: list.galleries.length })}
								{#if list.minOrder} · {t('admin.priceLists.minOrder')}: {money(list.minOrder)}{/if}
							</p>
							{#if list.galleries.length}
								<p class="hint">{#each list.galleries as g, i (g.id)}{i ? ', ' : ''}<a href="/admin/galleries/{g.id}?tab=settings">{g.name}</a>{/each}</p>
							{/if}
						</div>
						<div class="row">
							<a class="btn small" href="/admin/store/price-lists/{list.id}">{t('common.edit')}</a>
							{#if !list.isDefault}
								<form method="POST" action="?/defaultPriceList" use:enhance={saved}><input type="hidden" name="id" value={list.id} /><button class="btn small ghost" type="submit">{t('admin.templates.makeDefault')}</button></form>
							{/if}
							<form method="POST" action="?/duplicatePriceList" use:enhance={saved}><input type="hidden" name="id" value={list.id} /><button class="btn small ghost" type="submit">{t('admin.priceLists.duplicate')}</button></form>
							<form method="POST" action="?/deletePriceList" use:enhance={saved} onsubmit={confirmSubmit(t('admin.priceLists.deleteConfirm', { name: list.name }))}>
								<input type="hidden" name="id" value={list.id} /><button class="btn small ghost" type="submit">{t('common.delete')}</button>
							</form>
						</div>
					</div>
				</div>
			{/each}
			<form class="card block row" method="POST" action="?/createPriceList">
				<input name="name" required maxlength="100" placeholder={t('admin.priceLists.namePlaceholder')} aria-label={t('common.name')} />
				<button class="btn primary" type="submit"><Plus size={14} />{t('admin.priceLists.new')}</button>
			</form>
		</div>
	{:else if data.tab === 'coupons' && data.coupons}
		<div class="row between">
			<div class="segmented">
				{#each ['active', 'scheduled', 'inactive'] as const as s (s)}
					<label class="choice"><input type="radio" bind:group={couponTab} value={s} />{t(`admin.coupons.${s}` as MessageKey)} ({data.coupons.filter((c) => c.state === s).length})</label>
				{/each}
			</div>
			<button class="btn primary" type="button" onclick={newCoupon}><Plus size={14} />{t('admin.coupons.new')}</button>
		</div>
		{@const rows = data.coupons.filter((c) => c.state === couponTab)}
		{#if rows.length === 0}
			<p class="hint">{t('admin.coupons.none')}</p>
		{:else}
			<div class="card table-wrap">
				<table class="data">
					<thead>
						<tr><th>{t('common.name')}</th><th>{t('admin.coupons.code')}</th><th>{t('admin.coupons.period')}</th><th>{t('admin.coupons.uses')}</th><th>{t('admin.coupons.banner')}</th><th></th></tr>
					</thead>
					<tbody>
						{#each rows as c (c.id)}
							<tr>
								<td>{c.name}</td>
								<td><code>{c.code}</code></td>
								<td>{c.startsOn}{c.endsOn ? ` – ${c.endsOn}` : ''}</td>
								<td class="tabular">{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
								<td>{c.banner ? t('common.on') : ''}</td>
								<td class="right">
									<button class="btn small" type="button" onclick={() => (editingCoupon = { ...c })}>{t('common.edit')}</button>
									<form class="inline" method="POST" action="?/deleteCoupon" use:enhance={saved} onsubmit={confirmSubmit(t('admin.coupons.deleteConfirm', { code: c.code }))}>
										<input type="hidden" name="id" value={c.id} /><button class="btn small ghost" type="submit">{t('common.delete')}</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else if data.tab === 'taxes' && data.taxes}
		<p class="hint">{t('admin.taxes.intro')}</p>
		<div class="card table-wrap">
			<table class="data">
				<thead><tr><th>{t('store.country')}</th><th>{t('admin.taxes.rate')}</th><th>{t('admin.taxes.shipping')}</th><th>{t('admin.taxes.digital')}</th><th></th></tr></thead>
				<tbody>
					{#each data.taxes as rate (rate.id)}
						<tr>
							<td>{countryName(rate.country, lang)}</td>
							<td class="tabular">{(rate.rate / 100).toLocaleString(lang)} %</td>
							<td>{rate.shipping ? t('common.on') : t('common.off')}</td>
							<td>{rate.digital ? t('common.on') : t('common.off')}</td>
							<td class="right">
								<form method="POST" action="?/deleteTax" use:enhance={saved}><input type="hidden" name="id" value={rate.id} /><button class="btn small ghost" type="submit">{t('common.delete')}</button></form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<form class="card block" method="POST" action="?/saveTax" use:enhance={saved}>
			<h3>{t('admin.taxes.add')}</h3>
			<div class="grid2">
				<label class="field"><span>{t('store.country')}</span><select name="country" required>{#each countries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}</select></label>
				<label class="field"><span>{t('admin.taxes.rate')} (%)</span><input name="rate" inputmode="decimal" required placeholder="25" /></label>
			</div>
			<label class="switch"><input type="checkbox" name="shipping" checked /><span>{t('admin.taxes.shippingHint')}</span></label>
			<label class="switch"><input type="checkbox" name="digital" checked /><span>{t('admin.taxes.digitalHint')}</span></label>
			{#if form?.taxError}<p class="error-text">{t('admin.taxes.err')}</p>{/if}
			<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
		</form>
	{:else if data.tab === 'shipping' && data.methods}
		<p class="hint">{t('admin.shipping.intro')}</p>
		<div class="stack">
			{#each [...data.methods, null] as m (m?.id ?? 'new')}
				<form class="card block" method="POST" action="?/saveShipping" use:enhance={saved}>
					{#if m}<input type="hidden" name="id" value={m.id} />{:else}<h3>{t('admin.shipping.add')}</h3>{/if}
					<div class="grid2">
						<label class="field"><span>{t('common.name')}</span><input name="name" required value={m?.name ?? ''} placeholder={t('admin.shipping.namePlaceholder')} /></label>
						<label class="field">
							<span>{t('store.country')}</span>
							<select name="country" value={m?.country ?? '*'}>
								<option value="*">{t('admin.shipping.international')}</option>
								{#each countries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
							</select>
						</label>
						<label class="field"><span>{t('admin.shipping.fee')} ({data.currency})</span><input name="fee" inputmode="decimal" value={m ? fromMinor(m.fee, data.currency) : ''} placeholder="0" /></label>
						<label class="field"><span>{t('admin.shipping.time')}</span><input name="deliveryTime" value={m?.deliveryTime ?? ''} placeholder={t('admin.shipping.timePlaceholder')} /></label>
					</div>
					<label class="switch"><input type="checkbox" name="pickup" checked={m?.pickup ?? false} /><span>{t('admin.shipping.pickup')}</span></label>
					<div class="row">
						<button class="btn primary" type="submit">{t('common.save')}</button>
						{#if m}
							<button class="btn ghost" type="submit" formaction="?/deleteShipping">{t('common.delete')}</button>
						{/if}
					</div>
				</form>
			{/each}
			{#if form?.shippingError}<p class="error-text">{t('admin.shipping.err')}</p>{/if}
			{#if data.carriers}<CarriersEditor carriers={data.carriers} />{/if}
		</div>
	{:else if data.tab === 'report' && data.report}
		<form class="filters card" method="GET">
			<input type="hidden" name="tab" value="report" />
			<label class="field"><span>{t('admin.report.from')}</span><input type="date" name="from" value={data.from} /></label>
			<label class="field"><span>{t('admin.report.to')}</span><input type="date" name="to" value={data.to} /></label>
			<div class="filter-actions">
				<button class="btn" type="submit">{t('admin.report.show')}</button>
				<a class="btn ghost" href="/admin/store/export/vat?from={data.from}&to={data.to}&currency={data.currency}">CSV</a>
			</div>
		</form>
		<div class="card table-wrap">
			<table class="data">
				<thead><tr><th>{t('admin.report.month')}</th><th>{t('admin.customers.orders')}</th><th class="right">{t('admin.report.revenue')}</th><th class="right">{t('admin.report.vat')}</th><th class="right">{t('store.refunded')}</th></tr></thead>
				<tbody>
					{#each data.report as m (m.month)}
						<tr><td>{m.month}</td><td class="tabular">{m.orders}</td><td class="right tabular">{money(m.revenue)}</td><td class="right tabular">{money(m.tax)}</td><td class="right tabular">{money(m.refunded)}</td></tr>
					{:else}
						<tr><td colspan="5" class="hint">{t('admin.orders.none')}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if data.tab === 'settings' && data.settings && data.stripe}
		<form class="card block" method="POST" action="?/settings" use:enhance={saved}>
			<label class="switch"><input type="checkbox" name="enabled" checked={data.settings.enabled} /><span>{t('admin.storeSettings.enabled')}</span></label>
			<p class="hint">{t('admin.storeSettings.enabledHint')}</p>
			<div class="grid2">
				<label class="field"><span>{t('admin.storeSettings.name')}</span><input name="name" value={data.settings.name} maxlength="120" /></label>
				<label class="field"><span>{t('admin.storeSettings.email')}</span><input name="email" type="email" value={data.settings.email} /></label>
				<label class="field">
					<span>{t('admin.storeSettings.currency')}</span>
					<select name="currency" value={data.settings.currency}>{#each data.currencies as c (c)}<option value={c}>{c}</option>{/each}</select>
					<p class="hint">{t('admin.storeSettings.currencyHint')}</p>
				</label>
			</div>
			<label class="field"><span>{t('store.terms')}</span><textarea name="terms" rows="6">{data.settings.terms}</textarea></label>
			<label class="field"><span>{t('store.license')}</span><textarea name="license" rows="6">{data.settings.license}</textarea></label>
			<p class="hint">{t('admin.storeSettings.formatting')}</p>
			<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
		</form>

		<section class="card block">
			<div class="row between">
				<h3>Stripe</h3>
				{#if data.stripe.connected}
					<span class="badge on">{t('admin.stripe.connected')} · {data.stripe.mode === 'live' ? t('admin.stripe.live') : t('admin.stripe.test')}</span>
				{:else}
					<span class="badge">{t('admin.stripe.notConnected')}</span>
				{/if}
			</div>
			{#if data.stripe.connected}
				<p>
					{#if data.stripe.accountName}<strong>{data.stripe.accountName}</strong> · {/if}<code>{data.stripe.keyHint}</code>
				</p>
				<p class="hint">
					{data.stripe.webhook ? t('admin.stripe.webhookOk', { url: data.stripe.webhookUrl }) : t('admin.stripe.webhookMissing')}
					{#if data.stripe.lastWebhookAt} · {t('admin.stripe.lastWebhook', { date: new Date(data.stripe.lastWebhookAt).toLocaleString(lang) })}{/if}
				</p>
			{:else if data.simulator}
				<div class="alert info"><p>{t('admin.stripe.simulator')}</p></div>
			{/if}
			{#if data.stripe.error}<p class="error-text">{data.stripe.error}</p>{/if}
			{#if form?.stripeError}<p class="error-text">{t(form.stripeError as MessageKey)}</p>{/if}
			<form class="stack" method="POST" action="?/stripeKey" use:enhance={saved}>
				<label class="field">
					<span>{data.stripe.connected ? t('admin.stripe.replaceKey') : t('admin.stripe.key')}</span>
					<input name="secretKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk_live_… / rk_live_…" required />
					<p class="hint">{t('admin.stripe.keyHint')}</p>
				</label>
				<div class="row">
					<button class="btn primary" type="submit">{t('admin.stripe.connect')}</button>
				</div>
			</form>
			{#if data.stripe.connected}
				<div class="row">
					<form method="POST" action="?/stripeWebhook" use:enhance={saved}><button class="btn" type="submit">{t('admin.stripe.recreateWebhook')}</button></form>
					<form method="POST" action="?/stripeDisconnect" use:enhance={saved} onsubmit={confirmSubmit(t('admin.stripe.disconnectConfirm'))}>
						<button class="btn ghost" type="submit">{t('admin.stripe.disconnect')}</button>
					</form>
				</div>
			{/if}
			<details>
				<summary>{t('admin.stripe.guideTitle')}</summary>
				<ol class="guide">
					<li>{t('admin.stripe.guide1')}</li>
					<li>{t('admin.stripe.guide2')}</li>
					<li>{t('admin.stripe.guide3')}</li>
					<li>{t('admin.stripe.guide4')}</li>
				</ol>
				<p class="hint">{t('admin.stripe.methods')}</p>
			</details>
		</section>
	{/if}
</main>

{#if editingCoupon && data.coupons}
	{@const c = editingCoupon}
	<Modal title={c.id ? t('admin.coupons.edit') : t('admin.coupons.new')} onclose={() => (editingCoupon = null)} wide>
		<form
			class="stack"
			method="POST"
			action="?/saveCoupon"
			use:enhance={() =>
				async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success') {
						toast(t('common.saved'));
						editingCoupon = null;
					}
				}}
		>
			{#if c.id}<input type="hidden" name="id" value={c.id} />{/if}
			<div class="grid2">
				<label class="field"><span>{t('common.name')}</span><input name="name" required value={c.name ?? ''} /></label>
				<label class="field"><span>{t('admin.coupons.code')}</span><input name="code" required value={c.code ?? ''} style="text-transform:uppercase" /></label>
			</div>
			<label class="field"><span>{t('admin.coupons.description')}</span><input name="description" value={c.description ?? ''} maxlength="300" /></label>
			<div class="grid2">
				<label class="field"><span>{t('admin.coupons.startsOn')}</span><input type="date" name="startsOn" value={c.startsOn ?? today} /></label>
				<label class="field"><span>{t('admin.coupons.endsOn')} <small class="hint">({t('common.optional')})</small></span><input type="date" name="endsOn" value={c.endsOn ?? ''} /></label>
			</div>
			<h3>{t('admin.coupons.discount')}</h3>
			<div class="grid2">
				<label class="field"><span>{t('admin.coupons.percent')}</span><input name="percent" type="number" min="1" max="100" value={c.percent ?? ''} /></label>
				<label class="field"><span>{t('admin.coupons.amountOff')} ({data.currency})</span><input name="amountOff" inputmode="decimal" value={c.amountOff ? fromMinor(c.amountOff, data.currency) : ''} /></label>
				<label class="field">
					<span>{t('admin.coupons.freeProduct')}</span>
					<select name="freeProductId" value={c.freeProductId ?? ''}>
						<option value="">—</option>
						{#each data.products as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
					</select>
				</label>
			</div>
			<label class="switch"><input type="checkbox" name="freeShipping" checked={c.freeShipping} /><span>{t('admin.coupons.freeShipping')}</span></label>
			<h3>{t('admin.coupons.conditions')}</h3>
			<div class="grid2">
				<label class="field"><span>{t('admin.coupons.minAmount')} ({data.currency})</span><input name="minAmount" inputmode="decimal" value={c.minAmount ? fromMinor(c.minAmount, data.currency) : ''} /></label>
				<label class="field"><span>{t('admin.coupons.maxUses')}</span><input name="maxUses" type="number" min="1" value={c.maxUses ?? ''} /></label>
			</div>
			<label class="switch"><input type="checkbox" name="oncePerGallery" checked={c.oncePerGallery} /><span>{t('admin.coupons.oncePerGallery')}</span></label>
			<details>
				<summary>{t('admin.coupons.limitGalleries')}</summary>
				<div class="checks">
					{#each data.galleries as g (g.id)}<label><input type="checkbox" name="galleryIds" value={g.id} checked={c.galleryIds?.includes(g.id)} />{g.name}</label>{/each}
				</div>
			</details>
			<details>
				<summary>{t('admin.coupons.limitProducts')}</summary>
				<div class="checks">
					{#each data.products as p (p.id)}<label><input type="checkbox" name="productIds" value={p.id} checked={c.productIds?.includes(p.id)} />{p.name}</label>{/each}
				</div>
			</details>
			<label class="switch"><input type="checkbox" name="banner" checked={c.banner} /><span>{t('admin.coupons.bannerHint')}</span></label>
			<label class="switch"><input type="checkbox" name="active" checked={c.active ?? true} /><span>{t('admin.coupons.activeSwitch')}</span></label>
			{#if form?.couponError}<p class="error-text">{t(form.couponError as MessageKey)}</p>{/if}
			<div class="row"><button class="btn primary" type="submit">{t('common.save')}</button><button class="btn ghost" type="button" onclick={() => (editingCoupon = null)}>{t('common.cancel')}</button></div>
		</form>
	</Modal>
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.problems {
		margin-bottom: 16px;
	}

	.problems ul {
		margin: 6px 0 0;
		padding-left: 18px;
	}

	.head h1 {
		margin-bottom: 16px;
	}

	.between {
		justify-content: space-between;
		align-items: center;
		margin-bottom: 14px;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
		padding: 16px 20px;
		margin-bottom: 16px;
	}

	.filters > input {
		flex: 1 1 160px;
		width: auto;
		min-width: 0;
	}

	.filters > select {
		flex: 0 1 200px;
		width: auto;
		min-width: 150px;
	}

	.filters > .field {
		flex: 0 1 200px;
	}

	.filter-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}

	.pager {
		display: flex;
		gap: 6px;
		margin-top: 14px;
	}

	.pager a {
		padding: 4px 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		text-decoration: none;
	}

	.pager a[aria-current='page'] {
		background: var(--text);
		color: var(--bg, #fff);
	}

	.title {
		font-weight: 600;
		font-size: 1.0625rem;
	}

	.history {
		margin: 0;
		padding-left: 18px;
	}

	.inline {
		display: inline;
	}

	.checks {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 6px;
		margin-top: 8px;
	}

	.checks label {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.guide {
		padding-left: 20px;
		line-height: 1.6;
	}

	summary {
		cursor: pointer;
	}

	h3 {
		font-size: 1rem;
	}
</style>
