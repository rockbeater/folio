<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import { useI18n } from '$lib/i18n';

	interface Props {
		slug: string;
		name: string;
		placeholder: string | null;
		color: string | null;
		error: 'wrong' | 'tooMany' | null;
		redirectTo: string;
		/** Form action; defaults to the gallery's unlock action. */
		action?: string;
	}

	let { slug, name, placeholder, color, error, redirectTo, action }: Props = $props();
	const { t } = useI18n();
</script>

<main class="gate" style:background-color={color ?? 'var(--color-surface)'}>
	{#if placeholder}<img class="bg" src={placeholder} alt="" aria-hidden="true" />{/if}
	<form class="panel" method="POST" action={action ?? `/g/${slug}/unlock`}>
		<Lock size={22} strokeWidth={1.5} />
		<h1>{name}</h1>
		<p>{t('client.password.prompt')}</p>
		<input type="hidden" name="redirectTo" value={redirectTo} />
		<label class="visually-hidden" for="gallery-password">{t('client.password.label')}</label>
		<input
			id="gallery-password"
			name="password"
			type="password"
			autocomplete="current-password"
			placeholder={t('client.password.label')}
			required
			aria-invalid={Boolean(error)}
		/>
		{#if error}
			<p class="error" role="alert">{error === 'tooMany' ? t('client.password.tooMany') : t('client.password.wrong')}</p>
		{/if}
		<button class="label" type="submit">{t('client.password.submit')}</button>
	</form>
</main>

<style>
	.gate {
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
		width: min(400px, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-3);
		padding: var(--space-7) var(--space-6);
		background: var(--color-bg);
	}

	h1 {
		margin: var(--space-2) 0 0;
		font-family: var(--font-display);
		font-weight: var(--display-weight);
		letter-spacing: var(--display-tracking);
		text-transform: var(--display-case);
		font-size: 1.5rem;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	p {
		margin: 0 0 var(--space-3);
		color: var(--color-text-muted);
	}

	input {
		width: 100%;
		height: 48px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		border-radius: 0;
		font-size: 1rem;
		text-align: center;
	}

	input:focus {
		border-color: var(--color-text);
		outline: none;
	}

	.error {
		margin: 0;
		color: var(--color-danger);
		font-size: 0.875rem;
	}

	button {
		width: 100%;
		height: 48px;
		margin-top: var(--space-2);
		border: 0;
		background: var(--color-text);
		color: var(--color-bg);
	}
</style>
