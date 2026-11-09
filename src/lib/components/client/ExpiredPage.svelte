<script lang="ts">
	import { useI18n } from '$lib/i18n';

	interface Props {
		name: string;
		studio: { name: string; email: string; phone: string; website: string };
		placeholder: string | null;
		color: string | null;
	}

	let { name, studio, placeholder, color }: Props = $props();
	const { t } = useI18n();
	const website = $derived(studio.website && !/^https?:\/\//.test(studio.website) ? `https://${studio.website}` : studio.website);
</script>

<main class="expired" style:background-color={color ?? 'var(--color-surface)'}>
	{#if placeholder}<img class="bg" src={placeholder} alt="" aria-hidden="true" />{/if}
	<div class="panel">
		<p class="label muted">{name}</p>
		<h1>{t('client.expired.title')}</h1>
		<p>{t('client.expired.text', { studio: studio.name || t('client.expired.photographer') })}</p>
		{#if studio.email || studio.phone || studio.website}
			<ul class="contact">
				{#if studio.email}<li><a href="mailto:{studio.email}">{studio.email}</a></li>{/if}
				{#if studio.phone}<li><a href="tel:{studio.phone.replace(/\s+/g, '')}">{studio.phone}</a></li>{/if}
				{#if studio.website}<li><a href={website} rel="noopener">{studio.website}</a></li>{/if}
			</ul>
		{/if}
	</div>
</main>

<style>
	.expired {
		position: relative;
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: var(--space-5) var(--space-4);
		overflow: hidden;
	}

	.bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(40px) saturate(1.1);
		transform: scale(1.2);
		opacity: 0.85;
	}

	.panel {
		position: relative;
		width: min(440px, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-7) var(--space-6);
		background: var(--color-bg);
		text-align: center;
	}

	.muted {
		margin: 0;
		color: var(--color-text-muted);
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: var(--display-weight);
		letter-spacing: var(--display-tracking);
		text-transform: var(--display-case);
		font-size: 1.5rem;
		line-height: 1.2;
	}

	p {
		margin: 0;
		color: var(--color-text-muted);
	}

	.contact {
		list-style: none;
		margin: var(--space-3) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
</style>
