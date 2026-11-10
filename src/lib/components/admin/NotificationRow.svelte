<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import Heart from '@lucide/svelte/icons/heart';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import { useI18n } from '$lib/i18n';
	import { formatMoney } from '$lib/store';
	import type { NotificationItem } from '$lib/server/notifications';

	let { item, isNew = false, now = Date.now() }: { item: NotificationItem; isNew?: boolean; now?: number } = $props();
	const { t, plural, lang } = useI18n();

	const ICONS = { order: ShoppingBag, selection: Heart, download: Download, registration: UserPlus };
	const Icon = $derived(ICONS[item.kind]);

	const text = $derived.by(() => {
		const who = item.who || t('admin.activity.anonymous');
		switch (item.kind) {
			case 'order':
				return t('admin.notify.order', { who, number: item.order!.number, amount: formatMoney(item.order!.total, item.order!.currency, lang) });
			case 'selection':
				return t('admin.notify.selection', { who, list: item.list || t('client.lists.default'), photos: plural('common.photos', item.count ?? 0) });
			case 'download':
				return item.count ? t('admin.notify.download', { who, photos: plural('common.photos', item.count) }) : t('admin.notify.downloadSome', { who });
			default:
				return t('admin.notify.registration', { who });
		}
	});

	/** "5 minutes ago" for the last week, then the date. */
	const when = $derived.by(() => {
		const seconds = Math.round((item.at - now) / 1000);
		const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
		if (seconds > -60) return rtf.format(0, 'second');
		if (seconds > -3600) return rtf.format(Math.round(seconds / 60), 'minute');
		if (seconds > -86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
		if (seconds > -7 * 86_400) return rtf.format(Math.round(seconds / 86_400), 'day');
		return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(item.at);
	});
</script>

<a class="row" class:new={isNew} href={item.href}>
	<span class="icon kind-{item.kind}"><Icon size={16} strokeWidth={1.75} /></span>
	<span class="body">
		<span class="text">{text}</span>
		<span class="meta">
			{#if item.galleryName}<span class="gallery">{item.galleryName}</span>{' · '}{/if}<time datetime={new Date(item.at).toISOString()}>{when}</time>
		</span>
	</span>
	{#if isNew}<span class="dot" aria-label={t('admin.notify.new')}></span>{/if}
</a>

<style>
	.row {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
	}

	.row:hover {
		background: var(--admin-bg);
	}

	.row.new {
		background: var(--accent-soft);
	}

	.icon {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--admin-bg);
		color: var(--muted);
	}

	.kind-order {
		color: var(--accent);
	}

	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.text {
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.meta {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.75rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dot {
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		margin-top: 6px;
		border-radius: 50%;
		background: var(--accent);
	}
</style>
