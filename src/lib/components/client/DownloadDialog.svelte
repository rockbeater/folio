<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { DownloadChoice, DownloadSettings } from '$lib/types';
	import { getGalleryState, type DownloadScope } from './gallery-state.svelte';

	interface Props {
		settings: DownloadSettings;
		sectionCount: number;
		/** Download URL; defaults to the gallery's. Quick share links have their own. */
		endpoint?: string;
	}

	interface Info {
		count: number;
		sizes: Partial<Record<DownloadChoice, { bytes: number; parts: number }>>;
		needsPin: boolean;
		needsEmail: boolean;
	}

	let { settings, sectionCount, endpoint }: Props = $props();
	const { t, plural, lang } = useI18n();
	const gs = getGalleryState();
	const request = gs.download!;

	const sectionAllowed = $derived(!settings.sections || (request.sectionId ? settings.sections.includes(request.sectionId) : false));
	const scopes = $derived.by(() => {
		const list: DownloadScope[] = [];
		if (request.scope === 'list') return ['list'] as DownloadScope[];
		if (request.photoId && settings.single) list.push('photo');
		list.push('all');
		if (request.sectionId && sectionCount > 1 && sectionAllowed) list.push('section');
		if (gs.favorites.size > 0) list.push('favorites');
		return list;
	});
	const sizes = $derived(
		([settings.highRes ? 'highres' : null, settings.web ? 'web' : null] as (DownloadChoice | null)[]).filter(
			(s): s is DownloadChoice => s !== null
		)
	);

	// svelte-ignore state_referenced_locally
	let scope = $state<DownloadScope>(request.scope === 'photo' && !settings.single ? 'all' : request.scope);
	// svelte-ignore state_referenced_locally
	let size = $state<DownloadChoice>(settings.highRes ? 'highres' : 'web');
	let info = $state<Info | null>(null);
	let refresh = $state(0);
	let pin = $state('');
	let pinError = $state('');
	let email = $state('');
	let emailError = $state('');
	let busy = $state(false);

	const base = $derived(endpoint ?? `/g/${gs.slug}/download`);

	function query(extra: Record<string, string> = {}): string {
		const params = new URLSearchParams({ scope, size, ...extra });
		if (gs.share) params.set('share', gs.share);
		if (scope === 'section' && request.sectionId) params.set('section', request.sectionId);
		if (scope === 'photo' && request.photoId) params.set('photo', request.photoId);
		if (scope === 'list' && request.listId) params.set('list', request.listId);
		return params.toString();
	}

	$effect(() => {
		void refresh;
		const url = `${base}?${query({ info: '1' })}`;
		let cancelled = false;
		fetch(url)
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (!cancelled) info = data;
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	});

	const current = $derived(info?.sizes[size]);
	const parts = $derived(scope === 'photo' ? 1 : (current?.parts ?? 1));

	function formatBytes(bytes: number): string {
		const units = ['B', 'KB', 'MB', 'GB'];
		let value = bytes;
		let unit = 0;
		while (value >= 1000 && unit < units.length - 1) {
			value /= 1000;
			unit++;
		}
		return `${new Intl.NumberFormat(lang, { maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0 }).format(value)} ${units[unit]}`;
	}

	async function submitPin(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		const res = await fetch(`/g/${gs.slug}/api/pin`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin, share: gs.share })
		}).catch(() => null);
		busy = false;
		if (res?.ok) {
			pinError = '';
			refresh += 1;
		} else {
			pinError = res?.status === 429 ? t('client.dl.pinTooMany') : t('client.dl.pinWrong');
		}
	}

	async function submitEmail(event: SubmitEvent) {
		event.preventDefault();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			emailError = t('client.email.invalid');
			return;
		}
		busy = true;
		const ok = await gs.submitEmail(email.trim());
		busy = false;
		if (ok) refresh += 1;
		else emailError = t('common.error');
	}

	async function start(part = 1) {
		const url = `${base}?${query(parts > 1 ? { part: String(part) } : {})}`;
		// On phones a single photo can go straight to the photo library via the share sheet.
		if (scope === 'photo' && navigator.canShare && matchMedia('(pointer: coarse)').matches) {
			try {
				const res = await fetch(url);
				const blob = await res.blob();
				const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('content-disposition') ?? '')?.[1];
				const file = new File([blob], decodeURIComponent(name ?? 'photo.jpg'), { type: blob.type });
				if (navigator.canShare({ files: [file] })) {
					await navigator.share({ files: [file] });
					gs.download = null;
					return;
				}
			} catch (err) {
				if ((err as Error).name === 'AbortError') return;
			}
		}
		const a = document.createElement('a');
		a.href = url;
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		a.remove();
		toast(t('client.dl.started'));
		if (parts <= 1) gs.download = null;
	}

	const scopeLabel: Record<DownloadScope, string> = {
		all: t('client.dl.all'),
		section: t('client.dl.section'),
		favorites: t('client.dl.favorites'),
		list: t('client.dl.list'),
		photo: t('client.dl.photo')
	};
</script>

<Modal title={t('client.dl.title')} onclose={() => (gs.download = null)}>
	{#if !settings.enabled || sizes.length === 0}
		<p>{t('client.dl.disabled')}</p>
	{:else if info?.needsEmail}
		<form onsubmit={submitEmail} novalidate class="step">
			<p class="intro">{t('client.dl.emailPrompt')}</p>
			<label class="visually-hidden" for="dl-email">{t('client.email.label')}</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input id="dl-email" type="email" autocomplete="email" placeholder={t('client.email.label')} bind:value={email} autofocus />
			{#if emailError}<p class="error" role="alert">{emailError}</p>{/if}
			<button class="primary label" type="submit" disabled={busy}>{t('common.continue')}</button>
		</form>
	{:else if info?.needsPin}
		<form onsubmit={submitPin} novalidate class="step">
			<p class="intro">{t('client.dl.pinPrompt')}</p>
			<label class="visually-hidden" for="dl-pin">{t('client.dl.pinLabel')}</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="dl-pin"
				class="pin tabular"
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength="4"
				pattern="[0-9]{4}"
				placeholder="••••"
				bind:value={pin}
				autofocus
			/>
			{#if pinError}<p class="error" role="alert">{pinError}</p>{/if}
			<button class="primary label" type="submit" disabled={busy || pin.length !== 4}>{t('common.continue')}</button>
		</form>
	{:else}
		{#if scopes.length > 1}
			<fieldset>
				<legend class="label">{t('client.dl.what')}</legend>
				<div class="options">
					{#each scopes as option (option)}
						<label class="option" class:selected={scope === option}>
							<input type="radio" name="scope" value={option} bind:group={scope} />
							<span>{scopeLabel[option]}</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<fieldset>
			<legend class="label">{t('client.dl.size')}</legend>
			<div class="options">
				{#each sizes as option (option)}
					{@const estimate = info?.sizes[option]}
					<label class="option" class:selected={size === option}>
						<input type="radio" name="size" value={option} bind:group={size} />
						<span>{option === 'highres' ? t('client.dl.highRes') : t('client.dl.web')}</span>
						<small>
							{option === 'highres' ? t('client.dl.highResHint') : t('client.dl.webHint')}
							{#if estimate && info && info.count > 1}
								· {t('client.dl.approx', { size: formatBytes(estimate.bytes) })}
							{/if}
						</small>
					</label>
				{/each}
			</div>
		</fieldset>

		{#if parts > 1}
			<p class="hint">{t('client.dl.parts', { count: parts })}</p>
			<div class="parts">
				{#each Array.from({ length: parts }, (_, i) => i + 1) as part (part)}
					<button class="primary label" type="button" onclick={() => start(part)}>
						{t('client.dl.part', { part, total: parts })}
					</button>
				{/each}
			</div>
		{:else}
			<button class="primary label" type="button" onclick={() => start()} disabled={!info || info.count === 0}>
				{t('client.dl.start')}
				{#if info && info.count > 1}· {plural('common.photos', info.count)}{/if}
			</button>
		{/if}
		{#if info?.count === 0 && scope === 'favorites'}<p class="hint">{t('client.dl.noFavorites')}</p>{/if}
	{/if}
</Modal>

<style>
	fieldset {
		margin: 0 0 var(--space-5);
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: var(--space-3);
		padding: 0;
	}

	.options {
		display: grid;
		gap: var(--space-2);
	}

	.option {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-border);
		cursor: pointer;
	}

	.option.selected {
		border: 2px solid var(--color-text);
		padding: calc(var(--space-3) - 1px) calc(var(--space-4) - 1px);
	}

	.option input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.option:has(input:focus-visible) {
		outline: 2px solid var(--color-text);
		outline-offset: 2px;
	}

	small {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}

	.step {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.intro {
		margin: 0 0 var(--space-2);
		color: var(--color-text-muted);
	}

	input[type='email'],
	input[type='text'] {
		height: 48px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		border-radius: 0;
		font-size: 1rem;
	}

	input:focus {
		border-color: var(--color-text);
		outline: none;
	}

	.pin {
		text-align: center;
		font-size: 1.5rem !important;
		letter-spacing: 0.5em;
	}

	.error {
		margin: 0;
		color: var(--color-danger);
		font-size: 0.875rem;
	}

	.primary {
		width: 100%;
		height: 48px;
		border: 0;
		background: var(--color-text);
		color: var(--color-bg);
	}

	.primary:disabled {
		opacity: 0.4;
	}

	.parts {
		display: grid;
		gap: var(--space-2);
	}

	.hint {
		margin: 0 0 var(--space-3);
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
