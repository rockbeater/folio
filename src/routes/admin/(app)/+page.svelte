<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { displayUrl } from '$lib/types';

	let { data, form } = $props();
	const { t, plural, formatDate } = useI18n();

	let creating = $state(false);
	let scanning = $state(false);

	// Refresh while photos are being prepared.
	$effect(() => {
		if (!data.galleries.some((g) => g.stats.pending > 0)) return;
		const timer = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (form?.create) creating = true;
	});
</script>

<svelte:head><title>{t('admin.galleries.title')} · Folio</title></svelte:head>

<main class="page">
	<div class="head">
		<h1>{t('admin.galleries.title')}</h1>
		<div class="row">
			<form
				method="POST"
				action="?/scan"
				use:enhance={() => {
					scanning = true;
					return async ({ update }) => {
						await update();
						scanning = false;
						toast(t('admin.galleries.scanned'));
					};
				}}
			>
				<button class="btn" type="submit" disabled={scanning}>
					<RefreshCw size={16} class={scanning ? 'spin' : ''} />
					{scanning ? t('admin.galleries.scanning') : t('admin.galleries.scan')}
				</button>
			</form>
			<button class="btn primary" type="button" onclick={() => (creating = true)}>
				<Plus size={16} />
				{t('admin.galleries.new')}
			</button>
		</div>
	</div>

	{#if !data.library.available}
		<div class="alert error"><TriangleAlert size={18} /><p>{t('admin.galleries.libraryMissing')}</p></div>
	{/if}
	<p class="hint library">{t('admin.galleries.libraryPath', { path: data.library.path })}</p>

	{#if data.galleries.length === 0}
		<div class="empty card">
			<ImageIcon size={28} strokeWidth={1.5} />
			<p>{t('admin.galleries.empty')}</p>
			<button class="btn primary" type="button" onclick={() => (creating = true)}>
				<Plus size={16} />
				{t('admin.galleries.new')}
			</button>
		</div>
	{:else}
		<ul class="grid">
			{#each data.galleries as g (g.id)}
				<li>
					<a class="tile card" href="/admin/galleries/{g.id}">
						<div class="thumb" style:background-color={g.cover?.color ?? 'var(--line)'}>
							{#if g.cover}
								<img src={displayUrl(g.cover, 480)} alt="" loading="lazy" />
							{:else}
								<ImageIcon size={28} strokeWidth={1.25} />
							{/if}
						</div>
						<div class="meta">
							<div class="title-row">
								<h2>{g.name}</h2>
								{#if g.missing}
									<span class="badge missing">{t('admin.galleries.missing')}</span>
								{:else}
									<span class="badge {g.status}">{t(`status.${g.status}` as MessageKey)}</span>
								{/if}
							</div>
							<p class="hint">
								{#if g.eventDate}{formatDate(g.eventDate, 'short')} · {/if}{plural('common.photos', g.stats.total)}
							</p>
							{#if g.stats.pending > 0}
								<p class="hint progress">
									{t('admin.galleries.processing', { done: g.stats.ready, total: g.stats.total })}
								</p>
							{:else if g.warnings > 0}
								<p class="hint warn"><TriangleAlert size={14} /> {t('admin.galleries.warnings')}</p>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

{#if creating}
	<Modal title={t('admin.galleries.new')} onclose={() => (creating = false)}>
			<form method="POST" action="?/create" class="stack" use:enhance>
				<label class="field">
					<span>{t('admin.galleries.newName')}</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input type="text" name="name" required autofocus value={form?.create?.name ?? ''} />
					<p class="hint">{t('admin.galleries.newHint')}</p>
				</label>
				<label class="field">
					<span>{t('admin.galleries.newDate')} <span class="muted">({t('common.optional')})</span></span>
					<input type="date" name="eventDate" value={form?.create?.date ?? ''} />
				</label>
				{#if form?.create?.error}<p class="error-text">{t(form.create.error as MessageKey)}</p>{/if}
				<button class="btn primary" type="submit">{t('admin.galleries.create')}</button>
			</form>
	</Modal>
{/if}

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 20px 64px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	h1 {
		font-size: 1.5rem;
	}

	.library {
		margin-bottom: 24px;
		word-break: break-all;
	}

	.alert {
		margin-bottom: 12px;
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 20px;
	}

	.tile {
		display: block;
		overflow: hidden;
		text-decoration: none;
		transition: border-color var(--dur-micro) var(--ease-out);
	}

	.tile:hover {
		border-color: var(--muted);
	}

	.thumb {
		aspect-ratio: 3 / 2;
		display: grid;
		place-items: center;
		color: var(--muted);
		overflow: hidden;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.meta {
		padding: 12px 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}

	h2 {
		font-size: 0.9375rem;
		overflow-wrap: anywhere;
	}

	.progress {
		color: var(--accent);
	}

	.warn {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--warning);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 56px 24px;
		text-align: center;
		color: var(--muted);
	}

	.empty p {
		margin: 0;
		max-width: 46ch;
	}

	:global(.spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
