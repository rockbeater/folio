<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { useI18n } from '$lib/i18n';

	interface Props {
		slug: string;
		name: string;
		placeholder: string | null;
		color: string | null;
	}

	let { slug, name, placeholder, color }: Props = $props();
	const { t } = useI18n();
	let email = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			error = t('client.email.invalid');
			return;
		}
		busy = true;
		const res = await fetch(`/g/${slug}/api/visitor`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: email.trim(), registration: true })
		}).catch(() => null);
		busy = false;
		if (!res?.ok) {
			error = t('common.error');
			return;
		}
		await invalidateAll();
	}
</script>

<main class="gate" style:background-color={color ?? 'var(--color-surface)'}>
	{#if placeholder}<img class="bg" src={placeholder} alt="" aria-hidden="true" />{/if}
	<form class="panel" onsubmit={submit} novalidate>
		<h1>{name}</h1>
		<p>{t('client.register.prompt')}</p>
		<label class="visually-hidden" for="register-email">{t('client.email.label')}</label>
		<input
			id="register-email"
			type="email"
			autocomplete="email"
			placeholder={t('client.email.label')}
			bind:value={email}
			required
			aria-invalid={Boolean(error)}
		/>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button class="label" type="submit" disabled={busy}>{t('client.register.submit')}</button>
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
		margin: 0;
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

	button:disabled {
		opacity: 0.5;
	}
</style>
