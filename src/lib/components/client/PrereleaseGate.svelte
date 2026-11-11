<script lang="ts">
	import { useI18n } from '$lib/i18n';
	import GateShell, { type GateCover } from './GateShell.svelte';

	interface Props {
		slug: string;
		name: string;
		eventDate: string | null;
		subtitle?: string | null;
		cover?: GateCover | null;
	}

	let { slug, name, eventDate, subtitle = null, cover = null }: Props = $props();
	const { t, formatDate } = useI18n();
	let email = $state('');
	let error = $state('');
	let busy = $state(false);
	let done = $state<string | null>(null);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const address = email.trim();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
			error = t('client.email.invalid');
			return;
		}
		busy = true;
		error = '';
		const res = await fetch(`/g/${slug}/api/visitor`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: address, prerelease: true })
		}).catch(() => null);
		busy = false;
		if (!res?.ok) {
			error = res?.status === 429 ? t('client.password.tooMany') : t('common.error');
			return;
		}
		done = address;
	}
</script>

<!-- The gallery is not released yet: visitors can ask to be emailed when it is. -->
<GateShell title={name} subtitle={[eventDate ? formatDate(eventDate) : '', subtitle].filter(Boolean).join(' · ') || null} {cover}>
	<p class="gate-text">
		<strong>{t('client.prerelease.title')}</strong>
		{done ? t('client.prerelease.thanks', { email: done }) : t('client.prerelease.prompt')}
	</p>
	{#if !done}
		<form onsubmit={submit} novalidate>
			<label class="visually-hidden" for="prerelease-email">{t('client.email.label')}</label>
			<input
				class="gate-input"
				id="prerelease-email"
				type="email"
				autocomplete="email"
				placeholder={t('client.email.label')}
				bind:value={email}
				required
				aria-invalid={Boolean(error)}
			/>
			{#if error}<p class="gate-error" role="alert">{error}</p>{/if}
			<button class="gate-btn small" type="submit" disabled={busy}>{t('client.prerelease.submit')}</button>
		</form>
	{/if}
</GateShell>
