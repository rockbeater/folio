<script lang="ts">
	import Heart from '@lucide/svelte/icons/heart';
	import Download from '@lucide/svelte/icons/download';
	import Share from '@lucide/svelte/icons/share';
	import { useI18n } from '$lib/i18n';
	import type { NavStyle, SectionView } from '$lib/types';

	interface Props {
		slug: string;
		name: string;
		studioName: string;
		sections: SectionView[];
		activeSlug: string | null;
		favoritesActive: boolean;
		favoritesCount: number;
		showFavorites: boolean;
		showDownload: boolean;
		navStyle: NavStyle;
		ondownload: () => void;
		onshare: () => void;
	}

	let {
		slug,
		name,
		studioName,
		sections,
		activeSlug,
		favoritesActive,
		favoritesCount,
		showFavorites,
		showDownload,
		navStyle,
		ondownload,
		onshare
	}: Props = $props();
	const { t } = useI18n();
	const withText = $derived(navStyle === 'icon-text');
</script>

<header class="header">
	<div class="bar">
		<a class="brand" href="/g/{slug}" data-sveltekit-noscroll>
			<span class="name">{name}</span>
			{#if studioName}<span class="label studio">{studioName}</span>{/if}
		</a>

		{#if sections.length > 1}
			<nav class="sections desktop" aria-label={t('client.sections')}>
				{#each sections as section (section.id)}
					<a
						class="label"
						href="/g/{slug}/s/{section.slug}"
						aria-current={section.slug === activeSlug ? 'page' : undefined}
						data-sveltekit-noscroll>{section.name}</a
					>
				{/each}
			</nav>
		{/if}

		<div class="actions">
			{#if showFavorites}
				<a
					class="icon"
					class:text={withText}
					href="/g/{slug}/favorites"
					aria-current={favoritesActive ? 'page' : undefined}
					aria-label={t('client.favorites')}
				>
					<Heart size={22} strokeWidth={1.5} fill={favoritesCount > 0 ? 'currentColor' : 'none'} />
					{#if withText}<span class="label">{t('client.favorites')}</span>{/if}
					{#if favoritesCount > 0}<span class="badge tabular">{favoritesCount}</span>{/if}
				</a>
			{/if}
			{#if showDownload}
				<button type="button" class="icon" class:text={withText} onclick={ondownload} aria-label={t('client.download')}>
					<Download size={22} strokeWidth={1.5} />
					{#if withText}<span class="label">{t('client.download')}</span>{/if}
				</button>
			{/if}
			<button type="button" class="icon" class:text={withText} onclick={onshare} aria-label={t('client.share')}>
				<Share size={22} strokeWidth={1.5} />
				{#if withText}<span class="label">{t('client.share')}</span>{/if}
			</button>
		</div>
	</div>

	{#if sections.length > 1}
		<nav class="sections mobile" aria-label={t('client.sections')}>
			{#each sections as section (section.id)}
				<a
					class="label"
					href="/g/{slug}/s/{section.slug}"
					aria-current={section.slug === activeSlug ? 'page' : undefined}
					data-sveltekit-noscroll>{section.name}</a
				>
			{/each}
		</nav>
	{/if}
</header>

<style>
	.header {
		position: sticky;
		top: 0;
		z-index: 20;
		background: var(--color-bg);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-6);
		min-height: 76px;
		padding: var(--space-3) clamp(var(--space-4), 3vw, var(--space-7));
	}

	.brand {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-decoration: none;
		min-width: 0;
		flex-shrink: 1;
	}

	.name {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.0625rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.studio {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sections {
		display: flex;
		gap: var(--space-5);
	}

	.sections a {
		text-decoration: none;
		color: var(--color-text-muted);
		white-space: nowrap;
		padding: var(--space-2) 0;
		border-bottom: 1px solid transparent;
		transition: color var(--dur-micro) var(--ease-out);
	}

	.sections a:hover,
	.sections a[aria-current='page'] {
		color: var(--color-text);
	}

	.sections a[aria-current='page'] {
		border-bottom-color: currentColor;
	}

	.sections.desktop {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.sections.mobile {
		display: none;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
	}

	.icon {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-width: 44px;
		height: 44px;
		padding: 0 var(--space-2);
		border: 0;
		background: none;
		text-decoration: none;
	}

	.icon[aria-current='page'] {
		color: var(--color-text);
	}

	.badge {
		position: absolute;
		top: 2px;
		right: -4px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--color-accent);
		color: var(--color-bg);
		font-size: 0.6875rem;
		line-height: 18px;
		text-align: center;
	}

	.icon.text .badge {
		position: static;
	}

	@media (max-width: 899px) {
		.sections.desktop {
			display: none;
		}

		.sections.mobile {
			display: flex;
			overflow-x: auto;
			scrollbar-width: none;
			padding: 0 var(--space-4) var(--space-2);
			gap: var(--space-5);
		}

		.sections.mobile::-webkit-scrollbar {
			display: none;
		}

		.bar {
			min-height: 64px;
			gap: var(--space-3);
		}

		.icon.text .label {
			display: none;
		}
	}
</style>
