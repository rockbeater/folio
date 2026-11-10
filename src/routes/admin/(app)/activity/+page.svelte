<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import NotificationRow from '$lib/components/admin/NotificationRow.svelte';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import type { NotificationItem } from '$lib/server/notifications';

	let { data } = $props();
	const { t, lang } = useI18n();

	const FILTERS: { kind: string | null; label: MessageKey }[] = [
		{ kind: null, label: 'admin.notify.filterAll' },
		{ kind: 'order', label: 'admin.notify.filterOrders' },
		{ kind: 'selection', label: 'admin.notify.filterSelections' },
		{ kind: 'download', label: 'admin.notify.filterDownloads' },
		{ kind: 'registration', label: 'admin.notify.filterRegistrations' }
	];

	// What was new when the page opened stays marked while it is open.
	// svelte-ignore state_referenced_locally
	const seenBefore = data.seenAt;
	const now = Date.now();

	onMount(async () => {
		await fetch('/admin/api/notifications', { method: 'POST' }).catch(() => null);
		await invalidate('folio:notifications');
	});

	/** Items grouped by day: today, yesterday, then dates. */
	const days = $derived.by(() => {
		const groups: { label: string; items: NotificationItem[] }[] = [];
		const dayOf = (at: number) => new Date(at).toDateString();
		const today = dayOf(now);
		const yesterday = dayOf(now - 86_400_000);
		const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
		const date = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
		for (const item of data.items) {
			const day = dayOf(item.at);
			const label = day === today ? rtf.format(0, 'day') : day === yesterday ? rtf.format(-1, 'day') : date.format(item.at);
			const last = groups.at(-1);
			if (last?.label === label) last.items.push(item);
			else groups.push({ label, items: [item] });
		}
		return groups;
	});

	const olderHref = $derived.by(() => {
		const q = new URLSearchParams();
		if (data.kind) q.set('kind', data.kind);
		const last = data.items.at(-1);
		if (last) q.set('before', String(last.at));
		return `?${q}`;
	});
</script>

<svelte:head><title>{t('admin.notify.title')} · Folio</title></svelte:head>

<main class="page-wide">
	<h1>{t('admin.notify.title')}</h1>
	<p class="hint intro">{t('admin.notify.intro')}</p>

	<nav class="filters" aria-label={t('admin.notify.filter')}>
		{#each FILTERS as f (f.label)}
			<a class="chip" href={f.kind ? `?kind=${f.kind}` : '?'} aria-current={data.kind === f.kind ? 'page' : undefined}>{t(f.label)}</a>
		{/each}
	</nav>

	{#if data.items.length === 0}
		<div class="card empty"><p class="hint">{t('admin.notify.empty')}</p></div>
	{:else}
		{#each days as day (day.label)}
			<section class="day">
				<h2>{day.label}</h2>
				<div class="card list">
					{#each day.items as item (item.id)}
						<NotificationRow {item} {now} isNew={item.at > seenBefore} />
					{/each}
				</div>
			</section>
		{/each}
		{#if data.hasMore}
			<div class="more"><a class="btn" href={olderHref} data-sveltekit-noscroll>{t('admin.notify.older')}</a></div>
		{/if}
	{/if}
</main>

<style>
	h1 {
		margin-bottom: 4px;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 20px 0 24px;
	}

	.chip {
		padding: 6px 14px;
		border: 1px solid var(--line);
		border-radius: 999px;
		color: var(--muted);
		font-size: 0.875rem;
		text-decoration: none;
	}

	.chip[aria-current='page'] {
		border-color: var(--text);
		color: var(--text);
	}

	.day {
		margin-bottom: 24px;
	}

	.day h2 {
		margin: 0 0 8px;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.list {
		display: flex;
		flex-direction: column;
		padding: 6px;
	}

	.empty {
		padding: 32px;
		text-align: center;
	}

	.more {
		display: flex;
		justify-content: center;
	}
</style>
