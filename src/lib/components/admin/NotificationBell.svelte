<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import Bell from '@lucide/svelte/icons/bell';
	import { useI18n } from '$lib/i18n';
	import type { NotificationItem } from '$lib/server/notifications';
	import NotificationRow from './NotificationRow.svelte';

	let { unread: serverUnread }: { unread: number } = $props();
	const { t } = useI18n();

	let open = $state(false);
	let items = $state<NotificationItem[] | null>(null);
	let seenBefore = $state(0);
	// Follows the page data; set locally when the bell is opened or polled.
	let unread = $derived(serverUnread);
	let root = $state<HTMLElement>();

	async function toggle() {
		open = !open;
		if (!open) return;
		const res = await fetch('/admin/api/notifications').catch(() => null);
		if (!res?.ok) return;
		const data = (await res.json()) as { unread: number; seenAt: number; items: NotificationItem[] };
		items = data.items;
		// Keep the new ones marked while the list is open, then count them as seen.
		seenBefore = data.seenAt;
		if (data.unread > 0) {
			await fetch('/admin/api/notifications', { method: 'POST' }).catch(() => null);
			unread = 0;
			void invalidate('folio:notifications');
		}
	}

	onMount(() => {
		const close = (e: Event) => {
			if (open && root && !root.contains(e.target as Node)) open = false;
		};
		const key = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		// New activity shows up without reloading the page.
		const poll = async () => {
			if (document.hidden || open) return;
			const res = await fetch('/admin/api/notifications?count=1').catch(() => null);
			if (res?.ok) unread = ((await res.json()) as { unread: number }).unread;
		};
		const timer = setInterval(poll, 120_000);
		document.addEventListener('click', close);
		document.addEventListener('keydown', key);
		window.addEventListener('focus', poll);
		return () => {
			clearInterval(timer);
			document.removeEventListener('click', close);
			document.removeEventListener('keydown', key);
			window.removeEventListener('focus', poll);
		};
	});
</script>

<div class="bell" bind:this={root}>
	<button
		class="icon-btn"
		type="button"
		onclick={toggle}
		aria-expanded={open}
		aria-label={unread > 0 ? t('admin.notify.titleUnread', { count: unread }) : t('admin.notify.title')}
		title={t('admin.notify.title')}
	>
		<Bell size={18} />
		{#if unread > 0}<span class="badge tabular">{unread > 99 ? '99+' : unread}</span>{/if}
	</button>

	{#if open}
		<div class="panel" role="dialog" aria-label={t('admin.notify.title')}>
			<div class="head">
				<strong>{t('admin.notify.title')}</strong>
				<a href="/admin/activity" onclick={() => (open = false)}>{t('admin.notify.all')}</a>
			</div>
			<div class="list">
				{#if items === null}
					<p class="hint empty">{t('common.loading')}</p>
				{:else if items.length === 0}
					<p class="hint empty">{t('admin.notify.empty')}</p>
				{:else}
					{#each items as item (item.id)}
						<div role="presentation" onclick={() => (open = false)}>
							<NotificationRow {item} isNew={item.at > seenBefore} />
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.bell {
		position: relative;
	}

	.icon-btn {
		position: relative;
	}

	.badge {
		position: absolute;
		top: 0;
		right: -2px;
		min-width: 17px;
		height: 17px;
		padding: 0 4px;
		border-radius: 9px;
		background: var(--accent);
		color: var(--panel);
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 17px;
		text-align: center;
	}

	.panel {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 40;
		width: min(380px, calc(100vw - 24px));
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--panel);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
		/* The top bar's container right-aligns its text. */
		text-align: left;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--line);
	}

	.head a {
		color: var(--accent);
		font-size: 0.8125rem;
		text-decoration: none;
	}

	/* On phones the bell is not at the edge: keep the panel on screen. */
	@media (max-width: 640px) {
		.panel {
			position: fixed;
			top: 64px;
			right: 12px;
			left: 12px;
			width: auto;
		}
	}

	.list {
		max-height: min(480px, 70vh);
		overflow-y: auto;
		padding: 6px;
	}

	.empty {
		padding: 20px 12px;
		text-align: center;
	}
</style>
