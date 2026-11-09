<script lang="ts">
	import { useI18n } from '$lib/i18n';
	import { displaySrcset, displayUrl, type CoverLayout, type PhotoView } from '$lib/types';

	interface Props {
		name: string;
		eventDate: string | null;
		studioName: string;
		/** Light logo shown on top of full-screen covers instead of the studio name. */
		coverLogo?: string | null;
		layout: CoverLayout;
		cover: (PhotoView & { placeholder: string | null }) | null;
		focalX: number;
		focalY: number;
		onview: () => void;
	}

	let { name, eventDate, studioName, coverLogo = null, layout, cover, focalX, focalY, onview }: Props = $props();
	const { t, formatDate } = useI18n();

	const overlay = $derived(layout === 'center' || layout === 'bottom');
	const sizes = $derived(layout === 'split' ? '(max-width: 767px) 100vw, 60vw' : '100vw');
</script>

{#if cover && layout !== 'none'}
	<section class="cover cover--{layout}" class:overlay aria-label={name}>
		<div class="media" style:background-color={cover.color}>
			{#if cover.placeholder}
				<img class="placeholder" src={cover.placeholder} alt="" aria-hidden="true" />
			{/if}
			<img
				class="photo"
				src={displayUrl(cover, 1600)}
				srcset={displaySrcset(cover)}
				{sizes}
				alt=""
				fetchpriority="high"
				style:object-position="{focalX * 100}% {focalY * 100}%"
			/>
		</div>
		<div class="content">
			<h1 class="title">{name}</h1>
			{#if eventDate}
				<p class="label date">{formatDate(eventDate)}</p>
			{/if}
			<button type="button" class="view label" onclick={onview}>{t('client.viewGallery')}</button>
			{#if !overlay && studioName}
				<p class="label studio-inline">{studioName}</p>
			{/if}
		</div>
		{#if overlay && coverLogo}
			<img class="cover-logo" src={coverLogo} alt={studioName} />
		{:else if overlay && studioName}
			<p class="label studio">{studioName}</p>
		{/if}
	</section>
{/if}

<style>
	.cover {
		position: relative;
		width: 100%;
	}

	.media {
		position: relative;
		overflow: hidden;
	}

	.media img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder {
		filter: blur(24px);
		transform: scale(1.1);
	}

	.title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: var(--display-weight);
		font-size: clamp(2rem, 6vw, 4.5rem);
		line-height: 1.1;
		letter-spacing: var(--display-tracking);
		text-transform: var(--display-case);
		text-wrap: balance;
		overflow-wrap: anywhere;
	}

	.date {
		margin: var(--space-4) 0 0;
	}

	.view {
		margin-top: var(--space-6);
		min-height: 48px;
		padding: 0 var(--space-6);
		background: transparent;
		border: 1px solid currentColor;
		transition:
			background-color var(--dur-micro) var(--ease-out),
			color var(--dur-micro) var(--ease-out);
	}

	/* Full-screen layouts: text on the photo */
	.overlay {
		height: 100svh;
		min-height: 480px;
		color: #ffffff;
	}

	.overlay .media {
		position: absolute;
		inset: 0;
	}

	.overlay .media::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.18) 45%, rgba(0, 0, 0, 0.5));
	}

	.overlay .content {
		position: relative;
		z-index: 1;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-8) var(--space-5);
	}

	.overlay .view:hover {
		background: #ffffff;
		color: #1e1e1e;
	}

	.studio {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
		z-index: 1;
		margin: 0;
		text-align: center;
	}

	.cover-logo {
		position: absolute;
		left: 50%;
		bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
		z-index: 1;
		transform: translateX(-50%);
		max-width: min(220px, 50vw);
		max-height: 56px;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	.cover--bottom .cover-logo {
		left: clamp(var(--space-5), 6vw, var(--space-9));
		transform: none;
	}

	.cover--bottom .media::after {
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.1) 40%, rgba(0, 0, 0, 0.62));
	}

	.cover--bottom .content {
		align-items: flex-start;
		justify-content: flex-end;
		text-align: left;
		padding: var(--space-8) clamp(var(--space-5), 6vw, var(--space-9)) calc(var(--space-9) + var(--space-3));
	}

	.cover--bottom .studio {
		text-align: left;
		left: clamp(var(--space-5), 6vw, var(--space-9));
	}

	/* Split */
	.cover--split {
		display: grid;
		grid-template-columns: 3fr 2fr;
		min-height: 100svh;
	}

	.cover--split .content,
	.cover--frame .content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-7) var(--space-6);
	}

	.studio-inline {
		margin: var(--space-6) 0 0;
		color: var(--color-text-muted);
	}

	.cover--split .view:hover,
	.cover--frame .view:hover {
		background: var(--color-text);
		color: var(--color-bg);
	}

	/* Framed */
	.cover--frame {
		padding: var(--space-6) var(--space-6) 0;
	}

	.cover--frame .media {
		height: 78svh;
		min-height: 360px;
	}

	.cover--frame .content {
		padding: var(--space-7) var(--space-5) var(--space-6);
	}

	@media (max-width: 767px) {
		.cover--split {
			grid-template-columns: 1fr;
			grid-template-rows: 62svh auto;
		}

		.cover--split .content {
			padding: var(--space-7) var(--space-5);
		}

		.cover--frame {
			padding: var(--space-4) var(--space-4) 0;
		}

		.cover--frame .media {
			height: 64svh;
		}
	}
</style>
