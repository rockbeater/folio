<script lang="ts">
	import '$lib/styles/admin.css';
	import { page } from '$app/state';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { createI18n, provideI18n } from '$lib/i18n';
	import NotificationBell from '$lib/components/admin/NotificationBell.svelte';

	let { data, children } = $props();
	// svelte-ignore state_referenced_locally
	const i18n = createI18n(data.adminLanguage);
	provideI18n(i18n);
	const { t } = i18n;

	const nav = [
		{ href: '/admin', label: t('admin.nav.galleries'), match: (p: string) => p === '/admin' || p.startsWith('/admin/galleries') },
		{ href: '/admin/store', label: t('admin.nav.store'), match: (p: string) => p.startsWith('/admin/store') },
		{ href: '/admin/settings', label: t('admin.nav.settings'), match: (p: string) => p.startsWith('/admin/settings') }
	];
</script>

<div class="admin">
	<header class="topbar">
		<a class="brand" href="/admin">Folio</a>
		<nav>
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={item.match(page.url.pathname) ? 'page' : undefined}>{item.label}</a>
			{/each}
		</nav>
		<div class="right">
			<NotificationBell unread={data.unread} />
			<span class="studio">{data.studioName}</span>
			<form method="POST" action="/admin/logout">
				<button class="icon-btn" type="submit" aria-label={t('admin.nav.logout')} title={t('admin.nav.logout')}>
					<LogOut size={18} />
				</button>
			</form>
		</div>
	</header>
	{@render children()}
</div>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 28px;
		height: 56px;
		padding: 0 20px;
		background: var(--panel);
		border-bottom: 1px solid var(--line);
	}

	.brand {
		font-family: 'Jost Variable', var(--sans);
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		text-decoration: none;
	}

	nav {
		display: flex;
		gap: 4px;
		height: 100%;
	}

	nav a {
		display: flex;
		align-items: center;
		padding: 0 12px;
		color: var(--muted);
		text-decoration: none;
		font-weight: 500;
		border-bottom: 2px solid transparent;
	}

	nav a:hover {
		color: var(--text);
	}

	nav a[aria-current='page'] {
		color: var(--text);
		border-bottom-color: var(--accent);
	}

	.right {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}

	.studio {
		color: var(--muted);
		font-size: 0.8125rem;
	}

	form {
		margin: 0;
	}

	@media (max-width: 640px) {
		.topbar {
			gap: 12px;
			padding: 0 12px;
		}

		.studio {
			display: none;
		}

		nav a {
			padding: 0 8px;
		}
	}

	/* Small phones: the menu, the bell and log out need the room; "Galleries" leads home too. */
	@media (max-width: 480px) {
		.brand {
			display: none;
		}

		nav a {
			padding: 0 6px;
			font-size: 0.875rem;
		}
	}
</style>
