<script lang="ts">
	import { useI18n } from '$lib/i18n';
	import GateShell, { type GateCover } from './GateShell.svelte';

	interface Props {
		slug: string;
		name: string;
		subtitle?: string | null;
		cover?: GateCover | null;
		error: 'wrong' | 'tooMany' | null;
		redirectTo: string;
		/** Form action; defaults to the gallery's unlock action. */
		action?: string;
		/** Galleries with client access offer a way back to the guest/client choice. */
		onback?: (() => void) | null;
	}

	let { slug, name, subtitle = null, cover = null, error, redirectTo, action, onback = null }: Props = $props();
	const { t } = useI18n();
</script>

<GateShell title={name} {subtitle} {cover}>
	<p class="gate-text">
		<strong>{t('client.gate.privateTitle')}</strong>
		{t('client.gate.passwordPrompt')}
		{#if onback}<button class="gate-link" type="button" onclick={onback}>{t('client.gate.back')}</button>{/if}
	</p>
	<form method="POST" action={action ?? `/g/${slug}/unlock`}>
		<input type="hidden" name="redirectTo" value={redirectTo} />
		<label class="visually-hidden" for="gallery-password">{t('client.password.label')}</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			class="gate-input"
			id="gallery-password"
			name="password"
			type="password"
			autocomplete="current-password"
			placeholder={t('common.password')}
			required
			autofocus
			aria-invalid={Boolean(error)}
		/>
		{#if error}
			<p class="gate-error" role="alert">{error === 'tooMany' ? t('client.password.tooMany') : t('client.password.wrong')}</p>
		{/if}
		<button class="gate-btn small" type="submit">{t('client.gate.enter')}</button>
	</form>
</GateShell>
