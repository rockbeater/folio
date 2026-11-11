<script lang="ts">
	import { DEFAULT_BATCH, DEVICE_KINDS, METHODS_FOR, RECOMMENDED_METHODS } from '$lib/smart-download';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PresetsTab from '$lib/components/admin/settings/PresetsTab.svelte';
	import TemplatesTab from '$lib/components/admin/settings/TemplatesTab.svelte';
	import SystemTab from '$lib/components/admin/settings/SystemTab.svelte';
	import WatermarksTab from '$lib/components/admin/settings/WatermarksTab.svelte';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { SMTP_PRESETS } from '$lib/smtp-presets';
	import { toast } from '$lib/toast.svelte';
	import { LANGUAGE_NAMES, type Language } from '$lib/types';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data, form } = $props();
	const { t } = useI18n();

	const TABS = ['branding', 'preferences', 'homepage', 'watermarks', 'presets', 'email', 'templates', 'privacy', 'backup', 'system', 'account'] as const;
	type Tab = (typeof TABS)[number];
	const tab = $derived<Tab>((TABS as readonly string[]).includes(page.url.searchParams.get('tab') ?? '') ? (page.url.searchParams.get('tab') as Tab) : 'branding');
	const tabLabel: Record<Tab, MessageKey> = {
		branding: 'admin.studio.tabBranding',
		preferences: 'admin.studio.tabPreferences',
		homepage: 'admin.studio.tabHomepage',
		watermarks: 'admin.studio.tabWatermarks',
		presets: 'admin.studio.tabPresets',
		email: 'admin.studio.tabEmail',
		templates: 'admin.studio.tabTemplates',
		privacy: 'admin.studio.tabPrivacy',
		backup: 'admin.studio.tabBackup',
		system: 'admin.system.tab',
		account: 'admin.studio.tabAccount'
	};

	const saved: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				const d = result.data as { testOk?: string; relogin?: boolean } | undefined;
				if (d?.testOk) toast(t('admin.smtp.testOk', { email: d.testOk }));
				else toast(t('common.saved'));
				if (d?.relogin) goto('/admin/login');
			} else if (result.type === 'failure') {
				const d = result.data as { testError?: string; error?: string } | undefined;
				if (d?.testError) toast(t('admin.smtp.testFailed', { error: d.testError }), 'error', 10000);
				else toast(d?.error ? t(d.error as MessageKey) : t('common.error'), 'error');
			}
		};
	};

	// SMTP form values, so a provider preset can fill them in.
	// svelte-ignore state_referenced_locally
	let smtp = $state({ host: data.smtp.host, port: data.smtp.port, security: data.smtp.security });
	let presetHint = $state<MessageKey | null>(null);

	function applyPreset(event: Event) {
		const preset = SMTP_PRESETS.find((p) => p.id === (event.currentTarget as HTMLSelectElement).value);
		if (!preset) return;
		smtp = { host: preset.host, port: preset.port, security: preset.security };
		presetHint = preset.hint;
	}

	const errorText = $derived(form && 'error' in form && form.error ? t(form.error as MessageKey) : '');
	const languageName = (lang: string) => LANGUAGE_NAMES[lang as Language] ?? lang;
</script>

<svelte:head><title>{t('admin.studio.title')} · Folio</title></svelte:head>

<main class="page">
	<h1>{t('admin.studio.title')}</h1>
	<div class="layout">
		<!-- A menu at the side on wide screens (there are many sections), tabs that scroll on phones. -->
		<nav class="tabs side" aria-label={t('admin.studio.title')}>
			{#each TABS as item (item)}
				<a href="?tab={item}" aria-current={tab === item ? 'page' : undefined} data-sveltekit-noscroll data-sveltekit-replacestate>{t(tabLabel[item])}</a>
			{/each}
		</nav>
		<div class="content">
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
					<div class="three">
						<div class="field">
							<span>{t('admin.studio.logo')}</span>
							{#if data.studio.logo}
								<div class="logo"><img src="/branding/{data.studio.logo}" alt="" /></div>
								<label class="row"><input type="checkbox" name="removeLogo" />{t('admin.studio.logoRemove')}</label>
							{/if}
							<input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
							<p class="hint">{t('admin.studio.logoHint')}</p>
						</div>
						<div class="field">
							<span>{t('admin.studio.coverLogo')}</span>
							{#if data.studio.coverLogo}
								<div class="logo dark"><img src="/branding/{data.studio.coverLogo}" alt="" /></div>
								<label class="row"><input type="checkbox" name="removeCoverLogo" />{t('admin.studio.logoRemove')}</label>
							{/if}
							<input type="file" name="coverLogo" accept="image/png,image/webp,image/svg+xml" />
							<p class="hint">{t('admin.studio.coverLogoHint')}</p>
						</div>
						<div class="field">
							<span>{t('admin.studio.favicon')}</span>
							{#if data.studio.favicon}
								<div class="logo"><img src="/branding/{data.studio.favicon}" alt="" width="32" height="32" /></div>
								<label class="row"><input type="checkbox" name="removeFavicon" />{t('admin.studio.logoRemove')}</label>
							{/if}
							<input type="file" name="favicon" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml" />
							<p class="hint">{t('admin.studio.faviconHint')}</p>
						</div>
					</div>
					{#if errorText && form?.tab === 'branding'}<p class="error-text">{errorText}</p>{/if}
					<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
				</form>
			{:else if tab === 'preferences'}
				<form class="card block" method="POST" action="?/preferences" use:enhance={saved}>
					<div class="two">
						<label class="field">
							<span>{t('admin.prefs.adminLanguage')}</span>
							<select name="adminLanguage" value={data.studio.language}>
								{#each data.languages as lang (lang)}<option value={lang}>{languageName(lang)}</option>{/each}
							</select>
							<p class="hint">{t('admin.prefs.adminLanguageHint')}</p>
						</label>
						<label class="field">
							<span>{t('admin.prefs.defaultLanguage')}</span>
							<select name="defaultLanguage" value={data.preferences.defaultLanguage}>
								{#each data.languages as lang (lang)}<option value={lang}>{languageName(lang)}</option>{/each}
							</select>
							<p class="hint">{t('admin.prefs.defaultLanguageHint')}</p>
						</label>
					</div>
					<label class="field">
						<span>{t('admin.prefs.sharpening')}</span>
						<select name="sharpening" value={data.preferences.sharpening}>
							<option value="none">{t('admin.prefs.sharpening.none')}</option>
							<option value="standard">{t('admin.prefs.sharpening.standard')}</option>
							<option value="optimal">{t('admin.prefs.sharpening.optimal')}</option>
						</select>
						<p class="hint">{t('admin.prefs.sharpeningHint')}</p>
					</label>
					<h3>{t('admin.downloads.title')}</h3>
					<p class="hint">{t('admin.downloads.intro')}</p>
					<div class="devices">
						{#each DEVICE_KINDS as kind (kind)}
							<label class="device">
								<span>{t(`admin.downloads.device.${kind}` as MessageKey)}</span>
								<select name="dl_{kind}" value={data.preferences.downloads.methods[kind]}>
									{#each METHODS_FOR[kind] as method (method)}
										<option value={method}>
											{t(`admin.downloads.method.${method}` as MessageKey)}{method === RECOMMENDED_METHODS[kind] ? ` (${t('admin.downloads.recommended')})` : ''}
										</option>
									{/each}
								</select>
							</label>
						{/each}
					</div>
					<label class="field">
						<span>{t('admin.downloads.batch')}</span>
						<input type="number" name="dlBatch" min="1" max="200" value={data.preferences.downloads.batch} style="max-width: 120px" />
						<p class="hint">{t('admin.downloads.batchHint', { count: DEFAULT_BATCH })}</p>
					</label>
					<h3>{t('admin.prefs.banner')}</h3>
					<p class="hint">{t('admin.prefs.bannerHint')}</p>
					<label class="switch"><input type="checkbox" name="bannerEnabled" checked={data.preferences.banner.enabled} /><span>{t('admin.prefs.bannerEnabled')}</span></label>
					<div class="two">
						<label class="field">
							<span>{t('admin.prefs.bannerText')}</span>
							<input type="text" name="bannerText" value={data.preferences.banner.text} maxlength="200" />
						</label>
						<label class="field">
							<span>{t('admin.prefs.bannerCode')} <span class="muted">({t('common.optional')})</span></span>
							<input type="text" name="bannerCode" value={data.preferences.banner.code} maxlength="50" />
						</label>
					</div>
					<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
				</form>
			{:else if tab === 'homepage'}
				<form class="card block" method="POST" action="?/homepage" use:enhance={saved}>
					<p class="hint">{t('admin.home.intro')}</p>
					<label class="switch"><input type="checkbox" name="enabled" checked={data.preferences.homepage.enabled} /><span>{t('admin.home.enabled')}</span></label>
					<label class="field">
						<span>{t('admin.home.title')}</span>
						<input type="text" name="title" value={data.preferences.homepage.title} maxlength="120" placeholder={data.studio.name} />
					</label>
					<label class="field">
						<span>{t('admin.home.text')}</span>
						<textarea name="intro" rows="4" maxlength="2000">{data.preferences.homepage.intro}</textarea>
					</label>
					<label class="field">
						<span>{t('admin.home.links')}</span>
						<textarea name="links" rows="3" placeholder="https://">{data.preferences.homepage.links.join('\n')}</textarea>
						<p class="hint">{t('admin.home.linksHint')}</p>
					</label>
					<p class="hint">{t('admin.home.contactHint')}</p>
					<div class="row">
						<button class="btn primary" type="submit">{t('common.save')}</button>
						<a class="btn ghost" href="/" target="_blank" rel="noopener">{t('admin.home.view')}</a>
					</div>
				</form>
			{:else if tab === 'watermarks'}
				<WatermarksTab watermarks={data.watermarks} {saved} />
			{:else if tab === 'presets'}
				<PresetsTab presets={data.presets} {saved} />
			{:else if tab === 'email'}
				{#if data.smtpFromEnv}
					<div class="alert info"><p>{t('admin.smtp.envNotice')}</p></div>
				{/if}
				<form class="card block" method="POST" action="?/smtp" use:enhance={saved}>
					<p class="hint">{t('admin.smtp.intro')}</p>
					<fieldset disabled={data.smtpFromEnv}>
						<label class="field">
							<span>{t('admin.smtp.provider')}</span>
							<select onchange={applyPreset}>
								<option value="">{t('admin.smtp.providerChoose')}</option>
								{#each SMTP_PRESETS as preset (preset.id)}<option value={preset.id}>{preset.name}</option>{/each}
							</select>
							{#if presetHint}<p class="hint">{t(presetHint)}</p>{/if}
						</label>
						<div class="grid-smtp">
							<label class="field host">
								<span>{t('admin.smtp.host')}</span>
								<input type="text" name="host" bind:value={smtp.host} placeholder="smtp.example.com" autocomplete="off" />
							</label>
							<label class="field">
								<span>{t('admin.smtp.port')}</span>
								<input type="number" name="port" bind:value={smtp.port} min="1" max="65535" />
							</label>
						</div>
						<label class="field">
							<span>{t('admin.smtp.security')}</span>
							<select name="security" bind:value={smtp.security}>
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
					<p class="hint">{t('admin.smtp.deliverability')}</p>
					<div class="row">
						{#if !data.smtpFromEnv}<button class="btn primary" type="submit">{t('common.save')}</button>{/if}
						<button class="btn" type="submit" formaction="?/testSmtp" disabled={!data.smtpConfigured}>{t('admin.smtp.test')}</button>
					</div>
				</form>
			{:else if tab === 'templates'}
				<TemplatesTab templates={data.templates} languages={data.languages} defaultLanguage={data.preferences.defaultLanguage} {saved} />
			{:else if tab === 'privacy'}
				<form class="card block" method="POST" action="?/privacy" use:enhance={saved}>
					<h3>{t('admin.privacy.search')}</h3>
					<label class="field">
						<select name="searchVisibility" value={data.preferences.searchVisibility}>
							<option value="none">{t('admin.privacy.searchNone')}</option>
							<option value="homepage">{t('admin.privacy.searchHomepage')}</option>
						</select>
						<p class="hint">{t('admin.privacy.searchHint')}</p>
					</label>
					<h3>{t('admin.privacy.statistics')}</h3>
					<label class="switch"><input type="checkbox" name="ignoreAdminIps" checked={data.preferences.ignoreAdminIps} /><span>{t('admin.privacy.ignoreAdmin')}</span></label>
					<p class="hint">{t('admin.privacy.ignoreAdminHint')}</p>
					<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
				</form>
				<section class="card block">
					<h3>{t('admin.privacy.adminIps')}</h3>
					<p class="hint">{t('admin.privacy.adminIpsHint', { ip: data.currentIp || '?' })}</p>
					{#if data.adminIps.length > 0}
						<ul class="ips">
							{#each data.adminIps as entry (entry.ip)}<li><code>{entry.ip}</code> <span class="hint">{new Date(entry.lastSeen).toLocaleString()}</span></li>{/each}
						</ul>
					{/if}
					<form method="POST" action="?/forgetAdminIps" use:enhance={saved}><button class="btn ghost" type="submit">{t('admin.privacy.forgetIps')}</button></form>
				</section>
				<section class="card block">
					<h3>{t('admin.privacy.gdpr')}</h3>
					<p class="hint">{t('admin.privacy.gdprHint')}</p>
					<form class="row" method="GET">
						<input type="hidden" name="tab" value="privacy" />
						<input type="email" name="email" value={data.gdpr?.email ?? ''} placeholder={t('common.email')} required aria-label={t('common.email')} />
						<button class="btn" type="submit">{t('admin.dashboard.search')}</button>
					</form>
					{#if data.gdpr}
						{@const s = data.gdpr.summary}
						<p>{t('admin.privacy.found', { visits: s.visits, lists: s.lists, activity: s.activity, emails: s.emails, orders: s.orders })}</p>
						<div class="row">
							<a class="btn" href="/admin/api/gdpr?email={encodeURIComponent(data.gdpr.email)}">{t('admin.privacy.export')}</a>
							<form
								method="POST"
								action="?/gdprDelete"
								use:enhance={saved}
								onsubmit={(e) => {
									if (!confirm(t('admin.privacy.deleteConfirm', { email: data.gdpr!.email }))) e.preventDefault();
								}}
							>
								<input type="hidden" name="email" value={data.gdpr.email} />
								<button class="btn danger" type="submit">{t('admin.privacy.delete')}</button>
							</form>
						</div>
						<p class="hint">{t('admin.privacy.ordersKept')}</p>
					{/if}
					<p class="hint">{t('admin.privacy.noTracking')}</p>
				</section>
			{:else if tab === 'system'}
				<SystemTab results={data.health} />
			{:else if tab === 'backup'}
				<section class="card block">
					<h3>{t('admin.backup.download')}</h3>
					<p class="hint">{t('admin.backup.downloadHint')}</p>
					<div><a class="btn primary" href="/admin/api/backup">{t('admin.backup.downloadButton')}</a></div>
				</section>
				<form
					class="card block"
					method="POST"
					action="?/restore"
					enctype="multipart/form-data"
					use:enhance={({ cancel }) => {
						if (!confirm(t('admin.backup.restoreConfirm'))) cancel();
					}}
				>
					<h3>{t('admin.backup.restore')}</h3>
					<p class="hint">{t('admin.backup.restoreHint')}</p>
					<input type="file" name="backup" accept=".zip,application/zip" required />
					{#if errorText && form?.tab === 'backup'}<p class="error-text">{errorText}</p>{/if}
					<div><button class="btn danger" type="submit">{t('admin.backup.restoreButton')}</button></div>
				</form>
			{:else}
				<section class="card block">
					<div class="row between">
						<h3>{t('admin.totp.title')}</h3>
						<span class="badge" class:on={data.account.totp}>{data.account.totp ? t('common.on') : t('common.off')}</span>
					</div>
					<p class="hint">{t('admin.totp.intro')}</p>
					{#if form && 'recoveryCodes' in form && form.recoveryCodes}
						<div class="alert info">
							<p>{t('admin.totp.recoveryIntro')}</p>
							<pre class="codes">{(form.recoveryCodes as string[]).join('\n')}</pre>
						</div>
					{/if}
					{#if data.account.totp}
						<p class="hint">{t('admin.totp.recoveryLeft', { count: data.account.recoveryLeft })}</p>
						<form class="row" method="POST" action="?/totpDisable" use:enhance={saved}>
							<input type="password" name="password" required placeholder={t('admin.account.currentPassword')} autocomplete="current-password" aria-label={t('admin.account.currentPassword')} />
							<button class="btn ghost" type="submit">{t('admin.totp.disable')}</button>
						</form>
					{:else if data.totpSetup}
						<div class="totp-setup">
							<div class="qr">{@html data.totpSetup.qr}</div>
							<div class="stack">
								<p>{t('admin.totp.scan')}</p>
								<p class="hint">{t('admin.totp.manual')} <code>{data.totpSetup.secret}</code></p>
								<form class="row" method="POST" action="?/totpEnable" use:enhance={saved}>
									<input name="code" required inputmode="numeric" autocomplete="one-time-code" placeholder="123456" aria-label={t('admin.totp.code')} />
									<button class="btn primary" type="submit">{t('admin.totp.enable')}</button>
								</form>
								<form method="POST" action="?/totpCancel" use:enhance={saved}><button class="btn ghost small" type="submit">{t('common.cancel')}</button></form>
							</div>
						</div>
					{:else}
						<form method="POST" action="?/totpStart" use:enhance={saved}><button class="btn" type="submit">{t('admin.totp.setUp')}</button></form>
					{/if}
				</section>
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
		</div>
	</div>
</main>

<style>
	.page {
		max-width: 1120px;
		margin: 0 auto;
		padding: 28px 20px 64px;
	}

	h1 {
		margin-bottom: 20px;
	}

	.content {
		min-width: 0;
	}

	@media (min-width: 900px) {
		.layout {
			display: grid;
			grid-template-columns: 200px minmax(0, 1fr);
			gap: 32px;
			align-items: start;
		}

		.layout .side {
			position: sticky;
			top: 80px;
			flex-direction: column;
			gap: 2px;
			margin: 0;
			border-bottom: 0;
			overflow: visible;
		}

		.layout .side a {
			margin: 0;
			padding: 8px 12px;
			border-bottom: 0;
			border-radius: var(--radius);
			white-space: normal;
		}

		.layout .side a:hover {
			background: var(--panel);
			color: var(--text);
		}

		.layout .side a[aria-current='page'] {
			background: var(--accent-soft);
			color: var(--text);
		}
	}

	h1 {
		font-size: 1.5rem;
		margin-bottom: 16px;
	}

	h3 {
		font-size: 1rem;
		margin-top: 8px;
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

	.three {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
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

	.logo.dark {
		background: #3a3a3a;
	}

	.logo img {
		max-height: 60px;
		max-width: 200px;
	}

	@media (max-width: 760px) {
		.two,
		.three,
		.grid-smtp {
			grid-template-columns: 1fr;
		}
	}

	.between {
		justify-content: space-between;
		align-items: center;
	}

	.card + .card {
		margin-top: 16px;
	}

	.devices {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 10px 16px;
	}

	.device {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.9375rem;
	}

	.ips {
		margin: 0;
		padding-left: 18px;
		line-height: 1.8;
	}

	.totp-setup {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
		align-items: flex-start;
	}

	.qr :global(svg) {
		width: 180px;
		height: 180px;
		background: #fff;
		border-radius: 6px;
	}

	.codes {
		margin: 8px 0 0;
		font-size: 1rem;
		line-height: 1.7;
	}
</style>
