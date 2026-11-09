<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '$lib/components/admin/AuthCard.svelte';
	import { createI18n, type MessageKey } from '$lib/i18n';

	let { form } = $props();
	const { t } = createI18n('en');
	let busy = $state(false);
</script>

<svelte:head><title>{t('admin.login.title')} · Folio</title></svelte:head>

<AuthCard title={t('admin.login.title')}>
	<form
		method="POST"
		class="stack form"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<label class="field">
			<span>{t('common.email')}</span>
			<input type="email" name="email" value={form?.email ?? ''} required autocomplete="username" />
		</label>
		<label class="field">
			<span>{t('common.password')}</span>
			<input type="password" name="password" required autocomplete="current-password" />
		</label>
		{#if form?.error}<p class="error-text" role="alert">{t(form.error as MessageKey)}</p>{/if}
		<button class="btn primary" type="submit" disabled={busy}>{t('admin.login.submit')}</button>
	</form>
</AuthCard>

<style>
	.form {
		margin-top: 24px;
	}
</style>
