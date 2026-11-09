<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { useI18n } from '$lib/i18n';
	import GateShell, { type GateCover } from './GateShell.svelte';

	interface Props {
		slug: string;
		name: string;
		subtitle: string | null;
		cover: GateCover | null;
	}

	let { slug, name, subtitle, cover }: Props = $props();
	const { t } = useI18n();
	let mode = $state<'choose' | 'client'>('choose');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function enterAsGuest() {
		busy = true;
		await fetch(`/g/${slug}/api/access`, { method: 'POST' }).catch(() => null);
		await invalidateAll();
		busy = false;
	}

	async function enterAsClient(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		const res = await fetch(`/g/${slug}/api/client`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ password })
		}).catch(() => null);
		if (res?.ok) await invalidateAll();
		else error = t(res?.status === 429 ? 'client.password.tooMany' : res?.status === 400 ? 'client.password.wrong' : 'common.error');
		busy = false;
	}
</script>

<GateShell title={name} {subtitle} {cover}>
	{#if mode === 'choose'}
		<p class="gate-text"><strong>{t('client.gate.welcome')}</strong> {t('client.gate.choose')}</p>
		<button class="gate-btn" type="button" disabled={busy} onclick={enterAsGuest}>{t('client.gate.guest')}</button>
		<button class="gate-btn" type="button" disabled={busy} onclick={() => (mode = 'client')}>{t('client.gate.client')}</button>
	{:else}
		<p class="gate-text">
			<strong>{t('client.gate.clientTitle')}</strong>
			{t('client.gate.clientPrompt')}
			<button class="gate-link" type="button" onclick={() => ((mode = 'choose'), (error = ''))}>{t('client.gate.back')}</button>
		</p>
		<form onsubmit={enterAsClient}>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="gate-input"
				type="password"
				bind:value={password}
				autocomplete="current-password"
				placeholder={t('common.password')}
				aria-label={t('client.clientLogin.password')}
				required
				autofocus
				aria-invalid={Boolean(error)}
			/>
			{#if error}<p class="gate-error" role="alert">{error}</p>{/if}
			<button class="gate-btn small" type="submit" disabled={busy || !password}>{t('client.gate.enter')}</button>
		</form>
	{/if}
</GateShell>
