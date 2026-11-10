<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import CropDialog from '$lib/components/client/CropDialog.svelte';
	import { getGalleryState } from '$lib/components/client/gallery-state.svelte';
	import { countryOptions } from '$lib/countries';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { formatMoney, richText, type Crop } from '$lib/store';
	import { displayUrl } from '$lib/types';
	import type { CartLineView, CartView } from '$lib/server/store/cart';

	let { data, form } = $props();
	const { t, lang } = useI18n();
	const gs = getGalleryState();

	// svelte-ignore state_referenced_locally
	let view = $state<CartView | null>(data.cart);
	// svelte-ignore state_referenced_locally
	const values = form?.values;
	// The checkout fields are bound to state: plain value={…} inputs would be reset to their
	// first value whenever the totals above them update (e.g. after choosing the country).
	// svelte-ignore state_referenced_locally
	const buyer = $state({
		email: values?.email ?? data.email,
		name: values?.name ?? '',
		phone: values?.phone ?? '',
		line1: values?.address?.line1 ?? '',
		line2: values?.address?.line2 ?? '',
		postalCode: values?.address?.postalCode ?? '',
		city: values?.address?.city ?? ''
	});
	let country = $state(values?.country ?? '');
	let methodId = $state(values?.methodId ?? '');
	let coupon = $state('');
	let cropping = $state<CartLineView | null>(null);

	const money = (amount: number) => formatMoney(amount, view?.currency ?? 'EUR', lang);
	// svelte-ignore state_referenced_locally
	const countries = countryOptions(data.countries, lang);
	const method = $derived(view?.methods.find((m) => m.id === methodId) ?? null);
	const hasDigital = $derived(Boolean(view?.lines.some((l) => l.kind === 'digital')));
	const needsAddress = $derived(Boolean(view?.totals.needsShipping && method && !method.pickup));

	// Shipping and VAT depend on the country and the method: price the cart again when they change.
	// (Read here, not in the change handlers, so the request always has the new value.)
	let priced = '';
	$effect(() => {
		const key = `${country}|${methodId}`;
		if (key === priced) return;
		priced = key;
		void call('GET');
	});

	async function call(method: 'GET' | 'POST', body?: Record<string, unknown>) {
		const query = new URLSearchParams();
		if (country) query.set('country', country);
		if (methodId) query.set('method', methodId);
		const res = await fetch(`/g/${gs.slug}/api/cart?${query}`, {
			method,
			headers: body ? { 'content-type': 'application/json' } : undefined,
			body: body ? JSON.stringify(body) : undefined
		}).catch(() => null);
		if (!res?.ok) {
			toast(t('common.error'), 'error');
			return;
		}
		view = (await res.json()) as CartView;
		gs.cartCount = view.count;
		if (methodId && !view.methods.some((m) => m.id === methodId)) methodId = '';
		if (!methodId && view.methods.length === 1) methodId = view.methods[0].id;
	}

	function setQuantity(line: CartLineView, value: number) {
		if (value >= 1 && value <= 99) void call('POST', { action: 'update', itemId: line.id, quantity: value });
	}

	async function applyCoupon(event: SubmitEvent) {
		event.preventDefault();
		await call('POST', { action: 'coupon', code: coupon });
		if (view?.couponCode && !view.couponError) toast(t('store.couponApplied'));
	}

	async function saveCrop(crop: Crop) {
		const line = cropping!;
		cropping = null;
		await call('POST', { action: 'update', itemId: line.id, crop });
	}

	/** Thumbnail of the cropped part, using the photo as a background. */
	function cropStyle(line: CartLineView): string {
		const c = line.crop;
		if (!c || !line.photo) return '';
		const px = c.w < 1 ? (c.x / (1 - c.w)) * 100 : 0;
		const py = c.h < 1 ? (c.y / (1 - c.h)) * 100 : 0;
		return `background-image:url(${displayUrl(line.photo, 480)});background-size:${100 / c.w}% ${100 / c.h}%;background-position:${px}% ${py}%;aspect-ratio:${(c.w * line.photo.width) / (c.h * line.photo.height)}`;
	}

	/** Why the order cannot be placed yet; the pay button is never disabled without saying why. */
	const blocker = $derived.by(() => {
		if (!view) return '';
		if (view.cropsMissing > 0) return t('store.crop.missing', { count: view.cropsMissing });
		if (view.belowMinimum) return t('store.minimum', { amount: money(view.minOrder) });
		if (view.totals.needsShipping && !country) return t('store.chooseCountryFirst');
		if (view.totals.needsShipping && view.methods.length === 0) return t('store.noShipping');
		if (view.totals.needsShipping && !method) return t('store.chooseMethod');
		return '';
	});

	const errorText = $derived(form?.error ? t(`store.err.${form.error}` as MessageKey) + (form.message ? ` (${form.message})` : '') : '');
</script>

{#if data.state === 'open'}
	<h1 class="title label">{t('store.cart')}</h1>
	{#if !view}
		<p class="empty">{t('store.closed')}</p>
	{:else if view.lines.length === 0}
		<div class="empty">
			<p>{t('store.empty')}</p>
			<a class="c-btn" href="/g/{gs.slug}/store">{t('store.shop')}</a>
		</div>
	{:else}
		<div class="layout">
			<section class="lines">
				<ul>
					{#each view.lines as line (line.id)}
						<li class="line">
							{#if line.photo}
								{#if line.crop}
									<span class="thumb cropped" style={cropStyle(line)} role="img" aria-label={line.photo.filename}></span>
								{:else}
									<img class="thumb" src={displayUrl(line.photo, 480)} alt={line.photo.filename} />
								{/if}
							{:else}
								<span class="thumb blank"></span>
							{/if}
							<div class="info">
								<strong>{line.productName}</strong>
								{#if line.label}<span class="muted">{line.label}</span>{/if}
								{#if line.photo}<span class="muted small">{line.photo.filename}</span>{/if}
								{#if line.cropNeeded}<span class="error small">{t('store.crop.required')}</span>{/if}
								<div class="row">
									{#if line.kind === 'physical' && !line.maxOne}
										<label class="qty">
											<span class="visually-hidden">{t('store.quantity')}</span>
											<input
												class="c-input"
												type="number"
												min="1"
												max="99"
												value={line.quantity}
												onchange={(e) => setQuantity(line, Number(e.currentTarget.value))}
											/>
										</label>
									{/if}
									{#if line.aspect && line.photo && line.crop}
										<button class="c-btn small" class:solid={line.cropNeeded} type="button" onclick={() => (cropping = line)}>
											{line.cropNeeded ? t('store.crop.choose') : t('store.crop.adjust')}
										</button>
									{/if}
								</div>
							</div>
							<div class="amount tabular">
								{#if line.discount}<s class="muted">{money(line.gross)}</s>{/if}
								<span>{money(line.gross - line.discount)}</span>
							</div>
							<button class="remove" type="button" onclick={() => call('POST', { action: 'remove', itemId: line.id })} aria-label={t('store.remove')}>
								<X size={18} />
							</button>
						</li>
					{/each}
				</ul>

				<form class="coupon" onsubmit={applyCoupon}>
					<input class="c-input" bind:value={coupon} placeholder={view.couponCode ?? t('store.couponPlaceholder')} aria-label={t('store.coupon')} />
					<button class="c-btn" type="submit">{t('store.apply')}</button>
				</form>
				{#if view.couponCode && view.couponError}
					<p class="error">{t(`store.couponErr.${view.couponError}` as MessageKey)}</p>
				{:else if view.couponCode}
					<p class="muted small">{t('store.couponActive', { code: view.couponCode })}</p>
				{/if}
			</section>

			<form class="checkout" method="POST" action="?/checkout">
				<h2 class="label">{t('store.checkout')}</h2>
				<label class="field">
					<span>{t('common.email')}</span>
					<input class="c-input" type="email" name="email" required autocomplete="email" bind:value={buyer.email} />
				</label>
				<label class="field">
					<span>{t('common.name')}</span>
					<input class="c-input" name="name" required autocomplete="name" bind:value={buyer.name} />
				</label>
				<label class="field">
					<span>{t('store.phone')} <small class="muted">({t('common.optional')})</small></span>
					<input class="c-input" name="phone" type="tel" autocomplete="tel" bind:value={buyer.phone} />
				</label>
				<label class="field">
					<span>{t('store.country')}</span>
					<select class="c-input" name="country" required bind:value={country} autocomplete="country">
						<option value="">{t('store.chooseCountry')}</option>
						{#each countries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
					</select>
				</label>

				{#if view.totals.needsShipping && country}
					<fieldset class="field">
						<legend>{t('store.shipping')}</legend>
						{#if view.methods.length === 0}
							<p class="error">{t('store.noShipping')}</p>
						{/if}
						{#each view.methods as m (m.id)}
							<label class="method">
								<input type="radio" name="methodId" value={m.id} bind:group={methodId} />
								<span>{m.name}{#if m.deliveryTime} <small class="muted">· {m.deliveryTime}</small>{/if}</span>
								<span class="tabular">{m.fee ? money(m.fee) : t('store.free')}</span>
							</label>
						{/each}
					</fieldset>
				{/if}

				{#if needsAddress}
					<label class="field"><span>{t('store.address')}</span><input class="c-input" name="line1" required autocomplete="address-line1" bind:value={buyer.line1} /></label>
					<label class="field"><span class="visually-hidden">{t('store.address2')}</span><input class="c-input" name="line2" autocomplete="address-line2" placeholder={t('store.address2')} bind:value={buyer.line2} /></label>
					<div class="two">
						<label class="field"><span>{t('store.postalCode')}</span><input class="c-input" name="postalCode" required autocomplete="postal-code" bind:value={buyer.postalCode} /></label>
						<label class="field"><span>{t('store.city')}</span><input class="c-input" name="city" required autocomplete="address-level2" bind:value={buyer.city} /></label>
					</div>
				{/if}

				<dl class="totals tabular">
					<div><dt>{t('store.subtotal')}</dt><dd>{money(view.totals.subtotal)}</dd></div>
					{#if view.totals.discount}<div><dt>{t('store.discount')}</dt><dd>−{money(view.totals.discount)}</dd></div>{/if}
					{#if view.totals.needsShipping}
						<div><dt>{t('store.shipping')}</dt><dd>{method ? money(view.totals.shipping) : '—'}</dd></div>
					{/if}
					<div class="total"><dt>{t('store.total')}</dt><dd>{money(view.totals.total)}</dd></div>
					{#if country && view.totals.tax}<div class="muted small"><dt>{t('store.vatIncluded')}</dt><dd>{money(view.totals.tax)}</dd></div>{/if}
				</dl>


				{#if data.terms}
					<label class="accept">
						<input type="checkbox" name="terms" required />
						<span>{t('store.acceptTerms')}</span>
					</label>
					<details class="legal"><summary>{t('store.terms')}</summary><div>{@html richText(data.terms)}</div></details>
				{/if}
				{#if hasDigital && data.license}
					<label class="accept">
						<input type="checkbox" name="license" required />
						<span>{t('store.acceptLicense')}</span>
					</label>
					<details class="legal"><summary>{t('store.license')}</summary><div>{@html richText(data.license)}</div></details>
				{/if}

				{#if errorText}<p class="error" role="alert">{errorText}</p>{/if}
				{#if blocker}<p class="blocker">{blocker}</p>{/if}
				<button class="c-btn solid pay" type="submit" disabled={Boolean(blocker)}>
					{view.totals.total === 0 ? t('store.placeOrder') : t('store.pay', { amount: money(view.totals.total) })}
				</button>
			</form>
		</div>
	{/if}
{/if}

{#if cropping?.photo && cropping.aspect}
	<CropDialog photo={cropping.photo} aspect={cropping.aspect} crop={cropping.crop} onsave={saveCrop} onclose={() => (cropping = null)} />
{/if}

<style>
	.title {
		margin: var(--space-3) 0 var(--space-5);
		color: var(--color-text-muted);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-8) 0;
		color: var(--color-text-muted);
		text-align: center;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 400px);
		gap: var(--space-7);
		align-items: start;
	}

	.lines ul {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.line {
		display: grid;
		grid-template-columns: 88px 1fr auto auto;
		gap: var(--space-4);
		align-items: start;
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.thumb {
		display: block;
		width: 88px;
		max-height: 110px;
		object-fit: contain;
		background-color: var(--color-surface);
	}

	.thumb.blank {
		height: 88px;
	}

	.thumb.cropped {
		height: auto;
		background-repeat: no-repeat;
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.info .row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.qty input {
		width: 76px;
		height: 36px;
	}

	.amount {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.remove {
		padding: 4px;
		border: 0;
		background: none;
		color: var(--color-text-muted);
	}

	.muted {
		color: var(--color-text-muted);
	}

	.small {
		font-size: 0.8125rem;
	}

	.coupon {
		display: flex;
		gap: var(--space-2);
		max-width: 420px;
		margin-top: var(--space-5);
	}

	.checkout {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-5);
		background: var(--color-surface);
	}

	.checkout h2 {
		margin: 0 0 var(--space-2);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: 0;
		font-size: 0.9375rem;
	}

	.two {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: var(--space-3);
	}

	.method {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-3);
		align-items: center;
		padding: var(--space-2) 0;
	}

	.totals {
		margin: var(--space-3) 0 0;
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
		margin-top: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border);
		font-size: 1.125rem;
		font-weight: 600;
	}

	.accept {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		font-size: 0.9375rem;
	}

	.legal {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.legal summary {
		cursor: pointer;
	}

	.error {
		margin: 0;
		color: var(--color-danger);
		font-size: 0.875rem;
	}

	.blocker {
		margin: 0;
		padding: var(--space-3);
		border-left: 3px solid var(--color-danger);
		background: var(--color-bg);
		font-size: 0.9375rem;
	}

	.pay {
		margin-top: var(--space-3);
		min-height: 52px;
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 520px) {
		.line {
			grid-template-columns: 64px 1fr auto;
		}

		.thumb {
			width: 64px;
		}

		.remove {
			grid-column: 3;
			grid-row: 1;
			justify-self: end;
		}

		.amount {
			grid-column: 2 / 4;
			align-items: flex-start;
		}
	}
</style>
