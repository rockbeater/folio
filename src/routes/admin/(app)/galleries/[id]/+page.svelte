<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ActivityPanel from '$lib/components/admin/ActivityPanel.svelte';
	import CoverPicker from '$lib/components/admin/CoverPicker.svelte';
	import DesignPanel from '$lib/components/admin/DesignPanel.svelte';
	import EditorHeader from '$lib/components/admin/EditorHeader.svelte';
	import EmailPanel from '$lib/components/admin/EmailPanel.svelte';
	import PhotosPanel from '$lib/components/admin/PhotosPanel.svelte';
	import SectionList from '$lib/components/admin/SectionList.svelte';
	import SettingsPanel from '$lib/components/admin/SettingsPanel.svelte';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { displayUrl } from '$lib/types';

	let { data, form } = $props();
	const { t } = useI18n();

	const TABS = ['photos', 'design', 'settings', 'activity', 'email'] as const;
	type Tab = (typeof TABS)[number];
	const tab = $derived<Tab>(
		(TABS as readonly string[]).includes(page.url.searchParams.get('tab') ?? '') ? (page.url.searchParams.get('tab') as Tab) : 'photos'
	);
	const activeSection = $derived(data.sections.find((s) => s.id === page.url.searchParams.get('section')) ?? data.sections[0] ?? null);
	const allPhotos = $derived(data.sections.flatMap((s) => s.photos));
	const cover = $derived(
		allPhotos.find((p) => p.id === data.gallery.coverPhotoId && p.status === 'ready') ?? allPhotos.find((p) => p.status === 'ready') ?? null
	);
	let pickingCover = $state(false);

	// Keep refreshing while photos are processed or emails are being sent.
	$effect(() => {
		const busy = data.stats.pending > 0 || data.emailLog.some((e) => e.status === 'queued' && !e.scheduledFor);
		if (!busy) return;
		const timer = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(timer);
	});

	const tabLabel: Record<Tab, MessageKey> = {
		photos: 'admin.editor.tabPhotos',
		design: 'admin.editor.tabDesign',
		settings: 'admin.editor.tabSettings',
		activity: 'admin.editor.tabActivity',
		email: 'admin.editor.tabEmail'
	};
</script>

<svelte:head><title>{data.gallery.name} · Folio</title></svelte:head>

<EditorHeader gallery={data.gallery} baseUrl={data.baseUrl} presets={data.presets} otherGalleries={data.otherGalleries} />

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
			{#if allPhotos.some((p) => p.status === 'ready')}
				<button class="btn small change-cover" type="button" onclick={() => (pickingCover = true)}>{t('admin.cover.change')}</button>
			{/if}
		</div>
		<nav class="tabs" aria-label={t('admin.editor.tabs')}>
			{#each TABS as item (item)}
				<a href="?tab={item}" aria-current={tab === item ? 'page' : undefined} data-sveltekit-noscroll data-sveltekit-replacestate>{t(tabLabel[item])}</a>
			{/each}
		</nav>
		{#if tab === 'photos'}
			<SectionList sections={data.sections} activeId={activeSection?.id ?? null} />
		{/if}
	</aside>

	<section class="main">
		{#if tab === 'photos'}
			<PhotosPanel gallery={data.gallery} section={activeSection} sections={data.sections} stats={data.stats} baseUrl={data.baseUrl} />
		{:else if tab === 'design'}
			<DesignPanel gallery={data.gallery} {cover} onpickcover={() => (pickingCover = true)} />
		{:else if tab === 'settings'}
			<SettingsPanel
				gallery={data.gallery}
				sections={data.sections}
				baseUrl={data.baseUrl}
				languages={data.languages}
				watermarks={data.watermarks}
				form={form as { error?: string; section?: string } | null}
				store={data.store}
			/>
		{:else if tab === 'activity'}
			<ActivityPanel baseUrl={data.baseUrl} store={data.store} galleryId={data.gallery.id} activity={data.activity} galleryName={data.gallery.slug} />
		{:else}
			<EmailPanel
				gallery={data.gallery}
				templates={data.templates}
				defaultTemplateId={data.defaultTemplateId}
				log={data.emailLog}
				smtpConfigured={data.smtpConfigured}
				adminEmail={data.adminEmail}
				form={form as Record<string, unknown> | null}
			/>
		{/if}
	</section>
</div>

{#if pickingCover}
	<CoverPicker sections={data.sections} coverId={data.gallery.coverPhotoId} onclose={() => (pickingCover = false)} />
{/if}

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
		position: relative;
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

	.change-cover {
		position: absolute;
		right: 8px;
		bottom: 8px;
		background: rgba(255, 255, 255, 0.92);
		color: #1e1e1e;
		border-color: transparent;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		border-bottom: 1px solid var(--line);
	}

	.tabs a {
		flex: 1 1 auto;
		padding: 10px 6px;
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
