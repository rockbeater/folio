<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data, form } = $props();
	const { t } = useI18n();

	const TABS = ['branding', 'email', 'templates', 'account'] as const;
	type Tab = (typeof TABS)[number];
	const tab = $derived<Tab>((TABS as readonly string[]).includes(page.url.searchParams.get('tab') ?? '') ? (page.url.searchParams.get('tab') as Tab) : 'branding');
	const tabLabel: Record<Tab, MessageKey> = {
		branding: 'admin.studio.tabBranding',
		email: 'admin.studio.tabEmail',
		templates: 'admin.studio.tabTemplates',
		account: 'admin.studio.tabAccount'
	};

	let editing = $state<{ id: string; name: string; subject: string; body: string } | null>(null);

	const saved: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				const d = result.data as { testOk?: string; relogin?: boolean } | undefined;
				if (d?.testOk) toast(t('admin.smtp.testOk', { email: d.testOk }));
				else toast(t('common.saved'));
				editing = null;
				if (d?.relogin) goto('/admin/login');
			} else if (result.type === 'failure') {
				const d = result.data as { testError?: string; error?: string } | undefined;
				if (d?.testError) toast(t('admin.smtp.testFailed', { error: d.testError }), 'error', 10000);
				else toast(d?.error ? t(d.error as MessageKey) : t('common.error'), 'error');
			}
		};
	};

	const errorText = $derived(form && 'error' in form && form.error ? t(form.error as MessageKey) : '');
</script>

<svelte:head><title>{t('admin.studio.title')} · Folio</title></svelte:head>

<main class="page">
	<h1>{t('admin.studio.title')}</h1>
	<nav class="tabs">
		{#each TABS as item (item)}
			<a href="?tab={item}" aria-current={tab === item ? 'page' : undefined} data-sveltekit-noscroll data-sveltekit-replacestate>{t(tabLabel[item])}</a>
		{/each}
	</nav>

	{#if tab === 'branding'}
		<form class="card block" method="POST" action="?/branding" enctype="multipart/form-data" use:enhance={saved}>
			<label class="field">
				<span>{t('admin.studio.name')}</span>
				<input type="text" name="name" value={data.studio.name} required />
			</label>
			<label class="field">
				<span>{t('admin.studio.contactEmail')}</span>
				<input type="email" name="email" value={data.studio.email} />
				<p class="hint">{t('admin.studio.contactEmailHint')}</p>
			</label>
			<div class="two">
				<label class="field">
					<span>{t('admin.studio.phone')}</span>
					<input type="tel" name="phone" value={data.studio.phone} />
				</label>
				<label class="field">
					<span>{t('admin.studio.website')}</span>
					<input type="text" name="website" value={data.studio.website} />
				</label>
			</div>
			<div class="field">
				<span>{t('admin.studio.logo')}</span>
				{#if data.studio.logo}
					<div class="logo"><img src="/branding/{data.studio.logo}" alt="" /></div>
					<label class="row"><input type="checkbox" name="removeLogo" />{t('admin.studio.logoRemove')}</label>
				{/if}
				<input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
				<p class="hint">{t('admin.studio.logoHint')}</p>
			</div>
			{#if errorText && form?.tab === 'branding'}<p class="error-text">{errorText}</p>{/if}
			<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
		</form>
	{:else if tab === 'email'}
		{#if data.smtpFromEnv}
			<div class="alert info"><p>{t('admin.smtp.envNotice')}</p></div>
		{/if}
		<form class="card block" method="POST" action="?/smtp" use:enhance={saved}>
			<p class="hint">{t('admin.smtp.intro')}</p>
			<fieldset disabled={data.smtpFromEnv}>
				<div class="grid-smtp">
					<label class="field host">
						<span>{t('admin.smtp.host')}</span>
						<input type="text" name="host" value={data.smtp.host} placeholder="smtp.example.com" autocomplete="off" />
					</label>
					<label class="field">
						<span>{t('admin.smtp.port')}</span>
						<input type="number" name="port" value={data.smtp.port} min="1" max="65535" />
					</label>
				</div>
				<label class="field">
					<span>{t('admin.smtp.security')}</span>
					<select name="security" value={data.smtp.security}>
						<option value="starttls">{t('admin.smtp.security.starttls')}</option>
						<option value="tls">{t('admin.smtp.security.tls')}</option>
						<option value="none">{t('admin.smtp.security.none')}</option>
					</select>
				</label>
				<div class="two">
					<label class="field">
						<span>{t('admin.smtp.user')}</span>
						<input type="text" name="user" value={data.smtp.user} autocomplete="off" />
					</label>
					<label class="field">
						<span>{t('admin.smtp.pass')}</span>
						<input type="password" name="pass" autocomplete="new-password" placeholder={data.smtp.hasPass ? '••••••••' : ''} />
						{#if data.smtp.hasPass}<p class="hint">{t('admin.smtp.passKeep')}</p>{/if}
					</label>
				</div>
				<div class="two">
					<label class="field">
						<span>{t('admin.smtp.fromName')}</span>
						<input type="text" name="fromName" value={data.smtp.fromName} placeholder={data.studio.name} />
						<p class="hint">{t('admin.smtp.fromNameHint')}</p>
					</label>
					<label class="field">
						<span>{t('admin.smtp.fromEmail')}</span>
						<input type="email" name="fromEmail" value={data.smtp.fromEmail} />
						<p class="hint">{t('admin.smtp.fromEmailHint')}</p>
					</label>
				</div>
			</fieldset>
			<div class="row">
				{#if !data.smtpFromEnv}<button class="btn primary" type="submit">{t('common.save')}</button>{/if}
				<button class="btn" type="submit" formaction="?/testSmtp" disabled={!data.smtpConfigured}>{t('admin.smtp.test')}</button>
			</div>
		</form>
	{:else if tab === 'templates'}
		<p class="hint intro">{t('admin.templates.intro')}</p>
		<ul class="templates">
			{#each data.templates as tpl (tpl.id)}
				<li class="card">
					<div class="tpl-head">
						<div>
							<strong>{tpl.name}</strong>
							{#if tpl.isDefault}<span class="badge on">{t('admin.templates.default')}</span>{/if}
							<p class="hint">{tpl.subject}</p>
						</div>
						<div class="row">
							{#if !tpl.isDefault}
								<form method="POST" action="?/defaultTemplate" use:enhance={saved}>
									<input type="hidden" name="id" value={tpl.id} />
									<button class="btn small ghost" type="submit">{t('admin.templates.makeDefault')}</button>
								</form>
							{/if}
							<button class="btn small" type="button" onclick={() => (editing = { ...tpl })}>{t('common.edit')}</button>
							<form
								method="POST"
								action="?/deleteTemplate"
								use:enhance={({ cancel }) => {
									if (!confirm(t('admin.templates.deleteConfirm', { name: tpl.name }))) cancel();
									return saved({} as never);
								}}
							>
								<input type="hidden" name="id" value={tpl.id} />
								<button class="btn small ghost danger" type="submit">{t('common.delete')}</button>
							</form>
						</div>
					</div>
					{#if editing?.id === tpl.id}
						{@render editor()}
					{/if}
				</li>
			{/each}
		</ul>
		{#if editing && !editing.id}
			<div class="card new">{@render editor()}</div>
		{:else}
			<button class="btn" type="button" onclick={() => (editing = { id: '', name: '', subject: '', body: '' })}>
				<Plus size={16} />{t('admin.templates.new')}
			</button>
		{/if}
	{:else}
		<form class="card block" method="POST" action="?/account" use:enhance={saved}>
			<label class="field">
				<span>{t('admin.account.email')}</span>
				<input type="email" name="email" value={data.account.email} required autocomplete="username" />
			</label>
			<label class="field">
				<span>{t('admin.account.newPassword')} <span class="muted">({t('common.optional')})</span></span>
				<input type="password" name="newPassword" minlength="10" autocomplete="new-password" />
				<p class="hint">{t('admin.setup.passwordHint')}</p>
			</label>
			<label class="field">
				<span>{t('admin.account.currentPassword')}</span>
				<input type="password" name="currentPassword" required autocomplete="current-password" />
			</label>
			{#if errorText && form?.tab === 'account'}<p class="error-text">{errorText}</p>{/if}
			<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
		</form>
	{/if}
</main>

{#snippet editor()}
	{#if editing}
		<form class="stack tpl-form" method="POST" action="?/saveTemplate" use:enhance={saved}>
			<input type="hidden" name="id" value={editing.id} />
			<label class="field">
				<span>{t('common.name')}</span>
				<input type="text" name="name" bind:value={editing.name} required />
			</label>
			<label class="field">
				<span>{t('admin.email.subject')}</span>
				<input type="text" name="subject" bind:value={editing.subject} />
			</label>
			<label class="field">
				<span>{t('admin.email.message')}</span>
				<textarea name="body" bind:value={editing.body} rows="10"></textarea>
				<p class="hint">{t('admin.email.messageHint')}</p>
			</label>
			<div class="row">
				<button class="btn primary" type="submit">{t('common.save')}</button>
				<button class="btn ghost" type="button" onclick={() => (editing = null)}>{t('common.cancel')}</button>
			</div>
		</form>
	{/if}
{/snippet}

<style>
	.page {
		max-width: 820px;
		margin: 0 auto;
		padding: 28px 20px 64px;
	}

	h1 {
		font-size: 1.5rem;
		margin-bottom: 16px;
	}

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 24px;
		border-bottom: 1px solid var(--line);
		overflow-x: auto;
	}

	.tabs a {
		padding: 10px 12px;
		color: var(--muted);
		text-decoration: none;
		font-weight: 500;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		white-space: nowrap;
	}

	.tabs a[aria-current='page'] {
		color: var(--text);
		border-bottom-color: var(--accent);
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 22px 24px;
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.two,
	.grid-smtp {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	.grid-smtp {
		grid-template-columns: 1fr 120px;
	}

	.logo {
		display: inline-flex;
		align-self: flex-start;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: #fff;
	}

	.logo img {
		max-height: 60px;
		max-width: 240px;
	}

	.intro {
		margin-bottom: 16px;
	}

	.templates {
		list-style: none;
		margin: 0 0 16px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.templates li,
	.new {
		padding: 16px 18px;
	}

	.tpl-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.tpl-head strong {
		margin-right: 6px;
	}

	.tpl-head form {
		margin: 0;
	}

	.tpl-form {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}

	.new .tpl-form {
		margin-top: 0;
		padding-top: 0;
		border-top: 0;
	}

	@media (max-width: 640px) {
		.two,
		.grid-smtp {
			grid-template-columns: 1fr;
		}
	}
</style>
