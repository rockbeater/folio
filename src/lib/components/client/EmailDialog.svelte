<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n } from '$lib/i18n';
	import { getGalleryState } from './gallery-state.svelte';

	const { t } = useI18n();
	const gs = getGalleryState();
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
		const ok = await gs.submitEmail(email.trim());
		busy = false;
		if (!ok) error = t('common.error');
	}
</script>

<Modal title={t('client.email.title')} onclose={() => gs.cancelEmailPrompt()}>
	<form onsubmit={submit} novalidate>
		<p class="intro">{t('client.email.prompt')}</p>
		<label class="field">
			<span class="label">{t('client.email.label')}</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input type="email" autocomplete="email" bind:value={email} required autofocus aria-invalid={Boolean(error)} />
		</label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button class="primary label" type="submit" disabled={busy}>{t('client.email.submit')}</button>
	</form>
</Modal>

<style>
	.intro {
		margin: 0 0 var(--space-5);
		color: var(--color-text-muted);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	input {
		height: 48px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		font-size: 1rem;
		border-radius: 0;
	}

	input:focus {
		border-color: var(--color-text);
		outline: none;
	}

	.error {
		margin: var(--space-2) 0 0;
		color: var(--color-danger);
		font-size: 0.875rem;
	}

	.primary {
		width: 100%;
		height: 48px;
		margin-top: var(--space-5);
		border: 0;
		background: var(--color-text);
		color: var(--color-bg);
	}

	.primary:disabled {
		opacity: 0.5;
	}
</style>
