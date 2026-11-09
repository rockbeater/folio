<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';

	let { slug, onclose }: { slug: string; onclose: () => void } = $props();
	const { t } = useI18n();
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		const res = await fetch(`/g/${slug}/api/client`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ password })
		}).catch(() => null);
		busy = false;
		if (!res?.ok) {
			error = t(res?.status === 429 ? 'client.password.tooMany' : res?.status === 400 ? 'client.password.wrong' : 'common.error');
			return;
		}
		await invalidateAll();
		toast(t('client.clientLogin.done'));
		onclose();
	}
</script>

<Modal title={t('client.clientLogin.title')} {onclose}>
	<form class="form" onsubmit={submit}>
		<p class="intro">{t('client.clientLogin.prompt')}</p>
		<label class="field">
			<span class="label">{t('client.clientLogin.password')}</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input class="c-input" type="password" autocomplete="current-password" bind:value={password} required autofocus />
		</label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button class="c-btn solid" type="submit" disabled={busy || !password}>{t('client.clientLogin.submit')}</button>
	</form>
</Modal>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.intro {
		margin: 0;
		color: var(--color-text-muted);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.error {
		margin: 0;
		color: var(--color-danger);
		font-size: 0.875rem;
	}
</style>
