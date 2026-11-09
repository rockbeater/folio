<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { DownloadChoice, DownloadSettings } from '$lib/types';
	import { getGalleryState, type DownloadScope } from './gallery-state.svelte';

	interface Props {
		settings: DownloadSettings;
		sectionCount: number;
	}

	let { settings, sectionCount }: Props = $props();
	const { t, plural } = useI18n();
	const gs = getGalleryState();
	const request = gs.download!;

	const scopes = $derived.by(() => {
		const list: DownloadScope[] = [];
		if (request.photoId) list.push('photo');
		list.push('all');
		if (request.sectionId && sectionCount > 1) list.push('section');
		if (gs.favorites.size > 0) list.push('favorites');
		return list;
	});
	const sizes = $derived(
		([settings.highRes ? 'highres' : null, settings.web ? 'web' : null] as (DownloadChoice | null)[]).filter(
			(s): s is DownloadChoice => s !== null
		)
	);

	let scope = $state<DownloadScope>(request.scope);
	// svelte-ignore state_referenced_locally
	let size = $state<DownloadChoice>(settings.highRes ? 'highres' : 'web');
	let info = $state<{ count: number; highres: number; web: number } | null>(null);

	function query(extra: Record<string, string> = {}): string {
		const params = new URLSearchParams({ scope, size, ...extra });
		if (scope === 'section' && request.sectionId) params.set('section', request.sectionId);
		if (scope === 'photo' && request.photoId) params.set('photo', request.photoId);
		return params.toString();
	}

	$effect(() => {
		const url = `/g/${gs.slug}/download?${query({ info: '1' })}`;
		info = null;
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

	function formatBytes(bytes: number): string {
		const units = ['B', 'KB', 'MB', 'GB'];
		let value = bytes;
		let unit = 0;
		while (value >= 1000 && unit < units.length - 1) {
			value /= 1000;
			unit++;
		}
		return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0 }).format(value)} ${units[unit]}`;
	}

	async function start() {
		const url = `/g/${gs.slug}/download?${query()}`;
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
		gs.download = null;
	}

	const scopeLabel: Record<DownloadScope, string> = {
		all: t('client.dl.all'),
		section: t('client.dl.section'),
		favorites: t('client.dl.favorites'),
		photo: t('client.dl.photo')
	};
</script>

<Modal title={t('client.dl.title')} onclose={() => (gs.download = null)}>
	{#if !settings.enabled || sizes.length === 0}
		<p>{t('client.dl.disabled')}</p>
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
					<label class="option" class:selected={size === option}>
						<input type="radio" name="size" value={option} bind:group={size} />
						<span>{option === 'highres' ? t('client.dl.highRes') : t('client.dl.web')}</span>
						<small>
							{option === 'highres' ? t('client.dl.highResHint') : t('client.dl.webHint')}
							{#if info && info.count > 1}
								· {t('client.dl.approx', { size: formatBytes(option === 'highres' ? info.highres : info.web) })}
							{/if}
						</small>
					</label>
				{/each}
			</div>
		</fieldset>

		<button class="primary label" type="button" onclick={start} disabled={info?.count === 0}>
			{t('client.dl.start')}
			{#if info && info.count > 1}· {plural('common.photos', info.count)}{/if}
		</button>
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

	.hint {
		margin: var(--space-3) 0 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
