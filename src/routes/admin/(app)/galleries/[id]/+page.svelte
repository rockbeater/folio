<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import ImageIcon from '@lucide/svelte/icons/image';
	import EditorHeader from '$lib/components/admin/EditorHeader.svelte';
	import SectionList from '$lib/components/admin/SectionList.svelte';
	import PhotosPanel from '$lib/components/admin/PhotosPanel.svelte';
	import DesignPanel from '$lib/components/admin/DesignPanel.svelte';
	import SettingsPanel from '$lib/components/admin/SettingsPanel.svelte';
	import EmailPanel from '$lib/components/admin/EmailPanel.svelte';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { displayUrl } from '$lib/types';

	let { data, form } = $props();
	const { t } = useI18n();

	const TABS = ['photos', 'design', 'settings', 'email'] as const;
	type Tab = (typeof TABS)[number];
	const tab = $derived<Tab>((TABS as readonly string[]).includes(page.url.searchParams.get('tab') ?? '') ? (page.url.searchParams.get('tab') as Tab) : 'photos');
	const activeSection = $derived(
		data.sections.find((s) => s.id === page.url.searchParams.get('section')) ?? data.sections[0] ?? null
	);
	const allPhotos = $derived(data.sections.flatMap((s) => s.photos));
	const cover = $derived(
		allPhotos.find((p) => p.id === data.gallery.coverPhotoId && p.status === 'ready') ??
			allPhotos.find((p) => p.status === 'ready') ??
			null
	);

	// Keep refreshing while photos are processed or emails are being sent.
	$effect(() => {
		const busy = data.stats.pending > 0 || data.emailLog.some((e) => e.status === 'queued');
		if (!busy) return;
		const timer = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(timer);
	});

	const tabLabel: Record<Tab, MessageKey> = {
		photos: 'admin.editor.tabPhotos',
		design: 'admin.editor.tabDesign',
		settings: 'admin.editor.tabSettings',
		email: 'admin.editor.tabEmail'
	};
</script>

<svelte:head><title>{data.gallery.name} · Folio</title></svelte:head>

<EditorHeader gallery={data.gallery} baseUrl={data.baseUrl} />

{#if data.gallery.status !== 'published' && tab !== 'email'}
	<div class="notice">{t('admin.editor.notPublished')}</div>
{/if}

<div class="editor">
	<aside class="side">
		<div class="cover" style:background-color={cover?.color ?? 'var(--line)'}>
			{#if cover}
				<img src={displayUrl(cover, 960)} alt="" />
			{:else}
				<ImageIcon size={28} strokeWidth={1.25} />
			{/if}
		</div>
		<nav class="tabs" aria-label="Gallery">
			{#each TABS as item (item)}
				<a href="?tab={item}" aria-current={tab === item ? 'page' : undefined} data-sveltekit-noscroll data-sveltekit-replacestate
					>{t(tabLabel[item])}</a
				>
			{/each}
		</nav>
		{#if tab === 'photos'}
			<SectionList sections={data.sections} activeId={activeSection?.id ?? null} />
		{/if}
	</aside>

	<section class="main">
		{#if tab === 'photos'}
			<PhotosPanel gallery={data.gallery} section={activeSection} sections={data.sections} stats={data.stats} />
		{:else if tab === 'design'}
			<DesignPanel gallery={data.gallery} {cover} />
		{:else if tab === 'settings'}
			<SettingsPanel
				gallery={data.gallery}
				baseUrl={data.baseUrl}
				favorites={data.favorites}
				form={form as { error?: string; section?: string } | null}
			/>
		{:else}
			<EmailPanel
				gallery={data.gallery}
				templates={data.templates}
				log={data.emailLog}
				smtpConfigured={data.smtpConfigured}
				adminEmail={data.adminEmail}
				form={form as Record<string, unknown> | null}
			/>
		{/if}
	</section>
</div>

<style>
	.notice {
		padding: 8px 20px;
		background: var(--warning-soft);
		color: var(--warning);
		font-size: 0.8125rem;
	}

	.editor {
		display: grid;
		grid-template-columns: 280px 1fr;
		min-height: calc(100vh - 56px - 64px);
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 20px;
		background: var(--panel);
		border-right: 1px solid var(--line);
	}

	.cover {
		aspect-ratio: 3 / 2;
		display: grid;
		place-items: center;
		border-radius: 8px;
		overflow: hidden;
		color: var(--muted);
	}

	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border-bottom: 1px solid var(--line);
	}

	.tabs a {
		padding: 10px 2px;
		text-align: center;
		color: var(--muted);
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 500;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.tabs a[aria-current='page'] {
		color: var(--text);
		border-bottom-color: var(--accent);
	}

	.main {
		min-width: 0;
		padding: 24px 28px 64px;
	}

	@media (max-width: 900px) {
		.editor {
			grid-template-columns: 1fr;
		}

		.side {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}

		.cover {
			display: none;
		}

		.main {
			padding: 20px 16px 48px;
		}
	}
</style>
