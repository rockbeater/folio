<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import { createI18n, provideI18n } from '$lib/i18n';
	import { displaySrcset, displayUrl } from '$lib/types';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const i18n = createI18n(data.language);
	provideI18n(i18n);
	const { t, formatDate } = i18n;

	const title = $derived(data.homepage.title || data.studio.name || t('client.home.title'));

	function linkLabel(url: string): string {
		try {
			const host = new URL(url).hostname.replace(/^www\./, '');
			const name = host.split('.')[0];
			return name.charAt(0).toUpperCase() + name.slice(1);
		} catch {
			return url;
		}
	}
</script>

<svelte:head><title>{title}</title></svelte:head>

{#if !data.enabled}
	<main class="simple">
		{#if data.studio.name}<p class="label muted">{data.studio.name}</p>{/if}
		<h1>{t('client.home.title')}</h1>
		<p class="muted">{t('client.home.text')}</p>
	</main>
{:else}
	<div class="home" data-theme="light" data-fonts="modern">
		<header class="head">
			{#if data.studio.logo}<img class="logo" src={data.studio.logo} alt={data.studio.name} />{/if}
			<h1>{title}</h1>
			{#if data.homepage.intro}<p class="intro">{data.homepage.intro}</p>{/if}
		</header>

		<main class="galleries">
			{#if data.galleries.length === 0}
				<p class="muted center">{t('client.home.empty')}</p>
			{:else}
				<ul class="grid">
					{#each data.galleries as g (g.id)}
						<li>
							<a href="/g/{g.slug}" class="card">
								<span class="thumb" style:background-color={g.color ?? 'var(--color-surface)'}>
									{#if g.cover}
										<img src={displayUrl(g.cover, 960)} srcset={displaySrcset(g.cover)} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" alt="" loading="lazy" />
									{:else if g.placeholder}
										<img class="blur" src={g.placeholder} alt="" />
									{/if}
									{#if g.locked}<span class="lock" aria-label={t('client.password.title')}><Lock size={16} strokeWidth={1.75} /></span>{/if}
								</span>
								<span class="name">{g.name}</span>
								{#if g.eventDate}<span class="label muted">{formatDate(g.eventDate)}</span>{/if}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</main>

		<footer class="foot">
			{#if data.studio.name}<p class="label">{data.studio.name}</p>{/if}
			<p class="contact">
				{#if data.studio.email}<a href="mailto:{data.studio.email}">{data.studio.email}</a>{/if}
				{#if data.studio.phone}<a href="tel:{data.studio.phone.replace(/\s+/g, '')}">{data.studio.phone}</a>{/if}
				{#if data.studio.website}<a href={data.studio.website} rel="noopener">{linkLabel(data.studio.website)}</a>{/if}
				{#each data.homepage.links as link (link)}<a href={link} rel="noopener me">{linkLabel(link)}</a>{/each}
			</p>
		</footer>
	</div>
{/if}

<style>
	.simple {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		padding: var(--space-6) var(--space-5);
		text-align: center;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: var(--display-weight);
		letter-spacing: var(--display-tracking);
		text-transform: var(--display-case);
		font-size: clamp(1.75rem, 4vw, 2.75rem);
		line-height: 1.15;
	}

	.muted {
		margin: 0;
		color: var(--color-text-muted);
	}

	.center {
		text-align: center;
	}

	.home {
		min-height: 100svh;
		background: var(--color-bg);
		color: var(--color-text);
		font-family: var(--font-body);
	}

	.head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-9) var(--space-5) var(--space-7);
		text-align: center;
	}

	.logo {
		max-height: 64px;
		width: auto;
	}

	.intro {
		max-width: 620px;
		margin: 0;
		color: var(--color-text-muted);
		white-space: pre-line;
		line-height: 1.6;
	}

	.galleries {
		padding: 0 clamp(var(--space-4), 4vw, var(--space-8)) var(--space-8);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
		gap: var(--space-7) var(--space-5);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		text-decoration: none;
	}

	.thumb {
		position: relative;
		display: block;
		aspect-ratio: 3 / 2;
		overflow: hidden;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform var(--dur-big) var(--ease-out);
	}

	.thumb .blur {
		filter: blur(16px);
		transform: scale(1.1);
	}

	.card:hover .thumb img:not(.blur) {
		transform: scale(1.02);
	}

	.lock {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
	}

	.name {
		margin-top: var(--space-2);
		font-family: var(--font-display);
		font-size: 1.25rem;
	}

	.foot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-8) var(--space-5);
		border-top: 1px solid var(--color-border);
		text-align: center;
	}

	.foot p {
		margin: 0;
	}

	.contact {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2) var(--space-5);
	}

	.contact a {
		color: var(--color-text-muted);
		text-decoration: none;
	}

	.contact a:hover {
		color: var(--color-text);
	}
</style>
