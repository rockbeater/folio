<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '$lib/components/admin/AuthCard.svelte';
	import { createI18n, type MessageKey } from '$lib/i18n';

	let { form } = $props();
	const { t } = createI18n('en');
	let busy = $state(false);
	const err = (field: string) => {
		const key = (form?.errors as Record<string, string> | undefined)?.[field];
		return key ? t(key as MessageKey) : '';
	};
</script>

<svelte:head><title>{t('admin.setup.title')}</title></svelte:head>

<AuthCard title={t('admin.setup.title')} intro={t('admin.setup.intro')}>
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
			<span>{t('admin.setup.studioName')}</span>
			<input type="text" name="studioName" value={form?.studioName ?? ''} required autocomplete="organization" />
			<p class="hint">{t('admin.setup.studioNameHint')}</p>
			{#if err('studioName')}<p class="error-text">{err('studioName')}</p>{/if}
		</label>
		<label class="field">
			<span>{t('admin.setup.email')}</span>
			<input type="email" name="email" value={form?.email ?? ''} required autocomplete="email" />
			{#if err('email')}<p class="error-text">{err('email')}</p>{/if}
		</label>
		<label class="field">
			<span>{t('admin.setup.password')}</span>
			<input type="password" name="password" required minlength="10" autocomplete="new-password" />
			<p class="hint">{t('admin.setup.passwordHint')}</p>
			{#if err('password')}<p class="error-text">{err('password')}</p>{/if}
		</label>
		<label class="field">
			<span>{t('admin.setup.passwordRepeat')}</span>
			<input type="password" name="repeat" required autocomplete="new-password" />
			{#if err('repeat')}<p class="error-text">{err('repeat')}</p>{/if}
		</label>
		<button class="btn primary" type="submit" disabled={busy}>{t('admin.setup.submit')}</button>
	</form>
</AuthCard>

<style>
	.form {
		margin-top: 24px;
	}
</style>
