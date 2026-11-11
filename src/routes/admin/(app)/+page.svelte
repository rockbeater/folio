<script lang="ts">
	import { formatMoney } from '$lib/store';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Search from '@lucide/svelte/icons/search';
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { displayUrl } from '$lib/types';

	let { data, form } = $props();
	const { t, plural, formatDate, lang } = useI18n();

	let creating = $state(false);
	let scanning = $state(false);
	let status = $state('all');
	let tag = $state('');
	let search = $state('');
	let sort = $state<'newest' | 'oldest' | 'name' | 'event'>('newest');
	// svelte-ignore state_referenced_locally
	let libraryQuery = $state(data.q);

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const list = data.galleries.filter((g) => {
			if (status === 'expired' ? !g.expired : status !== 'all' && (g.status !== status || g.expired)) return false;
			if (tag && !g.tags.includes(tag)) return false;
			return !q || g.name.toLowerCase().includes(q);
		});
		const by = {
			newest: (a: (typeof list)[0], b: (typeof list)[0]) => b.createdAt - a.createdAt,
			oldest: (a: (typeof list)[0], b: (typeof list)[0]) => a.createdAt - b.createdAt,
			name: (a: (typeof list)[0], b: (typeof list)[0]) => a.name.localeCompare(b.name, lang),
			event: (a: (typeof list)[0], b: (typeof list)[0]) => (b.eventDate ?? '').localeCompare(a.eventDate ?? '')
		}[sort];
		return [...list].sort(by);
	});

	// Refresh while photos are being prepared.
	$effect(() => {
		if (!data.galleries.some((g) => g.stats.pending > 0)) return;
		const timer = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (form?.create) creating = true;
	});

	function searchLibrary(event: SubmitEvent) {
		event.preventDefault();
		const q = libraryQuery.trim();
		goto(q ? `?q=${encodeURIComponent(q)}` : '?', { keepFocus: true, noScroll: true, replaceState: true });
	}

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

	{#if data.expiring.length > 0 || data.newOrders.length > 0}
		<div class="widgets">
			{#if data.newOrders.length > 0}
				<section class="card widget">
					<h2>{t('admin.dashboard.newOrders', { count: data.newOrders.length })}</h2>
					<ul>
						{#each data.newOrders.slice(0, 6) as o (o.id)}
							<li>
								<a href="/admin/store/orders/{o.id}">#{o.number} · {o.name}</a>
								<span class="hint tabular">{formatMoney(o.total, o.currency, lang)}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			{#if data.expiring.length > 0}
				<section class="card widget">
					<h2>{t('admin.dashboard.expiring')}</h2>
					<ul>
						{#each data.expiring as g (g.id)}
							<li><a href="/admin/galleries/{g.id}?tab=settings">{g.name}</a><span class="hint">{formatDate(g.expiresOn!, 'short')}</span></li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	{/if}

	<form class="library-search" onsubmit={searchLibrary} role="search">
		<Search size={16} />
		<input type="search" bind:value={libraryQuery} placeholder={t('admin.dashboard.searchPhotos')} aria-label={t('admin.dashboard.searchPhotos')} />
		<button class="btn small" type="submit">{t('admin.dashboard.search')}</button>
	</form>

	{#if data.results}
		<section class="results">
			<h2>{t('admin.dashboard.results', { count: data.results.length, q: data.q })}</h2>
			{#if data.results.length === 0}
				<p class="hint">{t('admin.editor.noMatches')}</p>
			{:else}
				<ul class="result-grid">
					{#each data.results as r (r.id)}
						<li>
							<a href="/admin/galleries/{r.galleryId}?tab=photos&section={r.sectionId}" class="card result">
								<div class="thumb" style:background-color={r.color}>
									{#if r.status === 'ready'}<img src={displayUrl(r, 480)} alt="" loading="lazy" />{/if}
								</div>
								<span class="filename">{r.filename}</span>
								<span class="hint">{r.galleryName} · {r.sectionName}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
			<button class="btn small ghost" type="button" onclick={() => ((libraryQuery = ''), goto('?', { replaceState: true, noScroll: true }))}>{t('admin.bulk.clear')}</button>
		</section>
	{/if}

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
		<div class="filters">
			<input type="search" bind:value={search} placeholder={t('admin.dashboard.filterName')} aria-label={t('admin.dashboard.filterName')} />
			<select bind:value={status} aria-label={t('admin.dashboard.filterStatus')}>
				<option value="all">{t('admin.dashboard.allStatuses')}</option>
				<option value="published">{t('status.published')}</option>
				<option value="prerelease">{t('status.prerelease')}</option>
				<option value="draft">{t('status.draft')}</option>
				<option value="hidden">{t('status.hidden')}</option>
				<option value="expired">{t('admin.settings.expired')}</option>
			</select>
			{#if data.tags.length > 0}
				<select bind:value={tag} aria-label={t('admin.settings.tags')}>
					<option value="">{t('admin.dashboard.allTags')}</option>
					{#each data.tags as tg (tg)}<option value={tg}>{tg}</option>{/each}
				</select>
			{/if}
			<select bind:value={sort} aria-label={t('admin.editor.sort')}>
				<option value="newest">{t('admin.dashboard.sortNewest')}</option>
				<option value="oldest">{t('admin.dashboard.sortOldest')}</option>
				<option value="name">{t('admin.dashboard.sortName')}</option>
				<option value="event">{t('admin.dashboard.sortEvent')}</option>
			</select>
		</div>

		<ul class="grid">
			{#each filtered as g (g.id)}
				<li>
					<a class="tile card" href="/admin/galleries/{g.id}">
						<div class="thumb" style:background-color={g.cover?.color ?? 'var(--line)'}>
							{#if g.cover}
								<img src={displayUrl(g.cover, 480)} alt="" loading="lazy" style:object-position="{g.cover.focalX * 100}% {g.cover.focalY * 100}%" />
							{:else}
								<ImageIcon size={28} strokeWidth={1.25} />
							{/if}
						</div>
						<div class="meta">
							<div class="title-row">
								<h2>{g.name}</h2>
								{#if g.missing}
									<span class="badge missing">{t('admin.galleries.missing')}</span>
								{:else if g.expired}
									<span class="badge failed">{t('admin.settings.expired')}</span>
								{:else}
									<span class="badge {g.status}">{t(`status.${g.status}` as MessageKey)}</span>
								{/if}
							</div>
							<p class="hint">
								{#if g.eventDate}{formatDate(g.eventDate, 'short')} · {/if}{plural('common.photos', g.stats.total)}
							</p>
							{#if g.tags.length > 0}<p class="tags">{#each g.tags as tg (tg)}<span>{tg}</span>{/each}</p>{/if}
							{#if g.stats.pending > 0}
								<p class="hint progress">{t('admin.galleries.processing', { done: g.stats.ready, total: g.stats.total })}</p>
							{:else if g.warnings > 0}
								<p class="hint warn"><TriangleAlert size={14} /> {t('admin.galleries.warnings')}</p>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>
		{#if filtered.length === 0}<p class="hint">{t('admin.dashboard.noMatch')}</p>{/if}
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
		margin-bottom: 20px;
		word-break: break-all;
	}

	.alert {
		margin-bottom: 12px;
	}

	.widgets {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 16px;
		margin-bottom: 20px;
	}

	.widget {
		padding: 16px 18px;
	}

	.widget h2,
	.results h2 {
		font-size: 0.9375rem;
		margin-bottom: 10px;
	}

	.widget ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 0.875rem;
	}

	.widget li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}

	.library-search {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 520px;
		margin-bottom: 20px;
		color: var(--muted);
	}

	.results {
		margin-bottom: 28px;
	}

	.result-grid {
		list-style: none;
		margin: 0 0 12px;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 12px;
	}

	.result {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
		text-decoration: none;
		font-size: 0.8125rem;
	}

	.result .thumb {
		aspect-ratio: 1;
		border-radius: 4px;
	}

	.filename {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.filters {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}

	.filters input {
		flex: 1 1 220px;
		max-width: 320px;
	}

	.filters select {
		width: auto;
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
		position: relative;
		aspect-ratio: 3 / 2;
		display: grid;
		place-items: center;
		color: var(--muted);
		overflow: hidden;
	}

	/* Absolute, so the photo fills the frame and the cover's focal point applies. */
	.thumb img {
		position: absolute;
		inset: 0;
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

	.meta h2 {
		font-size: 0.9375rem;
		overflow-wrap: anywhere;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 2px 0 0;
	}

	.tags span {
		padding: 1px 8px;
		border-radius: 10px;
		background: var(--admin-bg);
		color: var(--muted);
		font-size: 0.75rem;
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
