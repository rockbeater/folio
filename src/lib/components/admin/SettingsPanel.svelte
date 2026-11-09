<script lang="ts">
	import { enhance } from '$app/forms';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { randomPassword } from '$lib/admin-actions';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { LANGUAGE_NAMES, type Language } from '$lib/types';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { AdminSection, EditorGallery } from './editor-types';

	interface Props {
		gallery: EditorGallery;
		sections: AdminSection[];
		baseUrl: string;
		languages: string[];
		watermarks: { id: string; name: string }[];
		form: { error?: string; section?: string } | null;
		store: { enabled: boolean; priceLists: { id: string; name: string; isDefault: boolean }[] };
	}

	let { gallery, sections, baseUrl, languages, watermarks, form, store }: Props = $props();
	const { t, formatDate } = useI18n();

	// svelte-ignore state_referenced_locally
	let password = $state(gallery.password ?? '');
	// svelte-ignore state_referenced_locally
	let download = $state({ ...gallery.download, pin: gallery.download.pin ?? '' });
	// svelte-ignore state_referenced_locally
	let limitSections = $state(gallery.download.sections !== null);
	// svelte-ignore state_referenced_locally
	let client = $state({
		...gallery.access,
		clientPassword: gallery.access.clientPassword ?? '',
		mode: gallery.access.clientDownload ? 'custom' : 'same',
		cd: gallery.access.clientDownload ?? { enabled: true, highRes: true, web: true }
	});
	// svelte-ignore state_referenced_locally
	let lists = $state(gallery.access.lists.map((l) => ({ ...l, limit: l.limit ?? ('' as number | '') })));
	const listsJson = $derived(
		JSON.stringify(lists.filter((l) => l.name.trim()).map((l) => ({ id: l.id, name: l.name.trim(), limit: Number(l.limit) || null })))
	);
	// svelte-ignore state_referenced_locally
	let expiresOn = $state(gallery.expiresOn ?? '');
	// svelte-ignore state_referenced_locally
	let reminder = $state(gallery.reminderDays !== null);

	const saved: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') toast(t('common.saved'));
			else toast(t('common.error'), 'error');
		};
	};

	/** Auto-submit the surrounding form when a switch changes. */
	function submitParent(event: Event) {
		(event.currentTarget as HTMLInputElement).form?.requestSubmit();
	}

	function randomPin(): string {
		return String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');
	}

	const expired = $derived(Boolean(gallery.expiresOn && gallery.expiresOn < new Date().toLocaleDateString('sv-SE')));
</script>

<div class="settings stack">
	<form class="card block" method="POST" action="?/general" use:enhance={saved}>
		<h3>{t('admin.settings.general')}</h3>
		<label class="field">
			<span>{t('admin.settings.url')}</span>
			<div class="url">
				<span class="prefix">{baseUrl}/g/</span>
				<input type="text" name="slug" value={gallery.slug} required pattern="[a-z0-9-]+" />
			</div>
			<p class="hint">{t('admin.settings.urlHint')}</p>
			{#if form?.section === 'general' && form.error === 'slugTaken'}<p class="error-text">{t('admin.settings.urlTaken')}</p>{/if}
		</label>
		<div class="two">
			<label class="field">
				<span>{t('admin.settings.clientName')}</span>
				<input type="text" name="clientName" value={gallery.clientName ?? ''} autocomplete="off" />
			</label>
			<label class="field">
				<span>{t('admin.settings.clientEmail')}</span>
				<input type="email" name="clientEmail" value={gallery.clientEmail ?? ''} autocomplete="off" />
				{#if form?.section === 'general' && form.error === 'clientEmail'}<p class="error-text">{t('admin.email.errRecipients')}</p>{/if}
			</label>
		</div>
		<p class="hint">{t('admin.settings.clientHint')}</p>
		<div class="two">
			<label class="field">
				<span>{t('admin.settings.language')}</span>
				<select name="language" value={gallery.language}>
					{#each languages as lang (lang)}<option value={lang}>{LANGUAGE_NAMES[lang as Language] ?? lang}</option>{/each}
				</select>
				<p class="hint">{t('admin.settings.languageHint')}</p>
			</label>
			<label class="field">
				<span>{t('admin.settings.tags')}</span>
				<input type="text" name="tags" value={gallery.tags.join(', ')} autocomplete="off" />
				<p class="hint">{t('admin.settings.tagsHint')}</p>
			</label>
		</div>
		<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
	</form>

	<form class="card block" method="POST" action="?/options" use:enhance={saved}>
		<h3>{t('admin.settings.experience')}</h3>
		{#each [['emailRegistration', 'admin.settings.emailRegistration', 'admin.settings.emailRegistrationHint'], ['galleryAssist', 'admin.settings.galleryAssist', 'admin.settings.galleryAssistHint'], ['slideshow', 'admin.settings.slideshow', 'admin.settings.slideshowHint'], ['showFilenames', 'admin.settings.showFilenames', 'admin.settings.showFilenamesHint'], ['banner', 'admin.settings.banner', 'admin.settings.bannerHint']] as [name, label, hint] (name)}
			<div class="option">
				<label class="switch">
					<input type="checkbox" {name} checked={gallery.options[name as keyof typeof gallery.options]} onchange={submitParent} />
					<span>{t(label as MessageKey)}</span>
				</label>
				<p class="hint">{t(hint as MessageKey)}</p>
			</div>
		{/each}
	</form>

	<form class="card block" method="POST" action="?/privacy" use:enhance={saved}>
		<h3>{t('admin.settings.privacy')}</h3>
		<label class="field">
			<span>{t('admin.settings.password')}</span>
			<div class="row nowrap">
				<input type="text" name="password" bind:value={password} autocomplete="off" spellcheck="false" />
				<button class="btn" type="button" onclick={() => (password = randomPassword())}>
					<RefreshCw size={14} />{t('common.generate')}
				</button>
			</div>
			<p class="hint">{t('admin.settings.passwordHint')}</p>
		</label>
		<label class="switch">
			<input type="checkbox" name="homepage" checked={gallery.access.homepage} />
			<span>{t('admin.settings.homepage')}</span>
		</label>
		<p class="hint">{t('admin.settings.homepageHint')}</p>
		<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
	</form>

	<form class="card block" method="POST" action="?/clientAccess" use:enhance={saved}>
		<div class="title-row">
			<h3>{t('admin.client.title')}</h3>
			<span class="badge" class:on={gallery.access.clientEnabled}>{gallery.access.clientEnabled ? t('common.on') : t('common.off')}</span>
		</div>
		<p class="hint">{t('admin.client.intro')}</p>
		<label class="switch">
			<input type="checkbox" name="clientEnabled" bind:checked={client.clientEnabled} />
			<span>{t('admin.client.enabled')}</span>
		</label>
		{#if client.clientEnabled}
			<label class="field">
				<span>{t('admin.client.password')}</span>
				<div class="row nowrap">
					<input type="text" name="clientPassword" bind:value={client.clientPassword} autocomplete="off" spellcheck="false" required />
					<button class="btn" type="button" onclick={() => (client.clientPassword = randomPassword())}>
						<RefreshCw size={14} />{t('common.generate')}
					</button>
				</div>
				<p class="hint">{t('admin.client.passwordHint')}</p>
				{#if form?.section === 'client' && form.error === 'clientPassword'}<p class="error-text">{t('admin.client.errPassword')}</p>{/if}
				{#if form?.section === 'client' && form.error === 'samePassword'}<p class="error-text">{t('admin.client.errSame')}</p>{/if}
			</label>
			{#if sections.length > 0}
				<fieldset class="field">
					<legend>{t('admin.client.sections')}</legend>
					<p class="hint">{t('admin.client.sectionsHint')}</p>
					<div class="section-list">
						{#each sections as section (section.id)}
							<label class="check"
								><input type="checkbox" name="clientSections" value={section.id} checked={gallery.access.clientSections.includes(section.id)} />{section.name}</label
							>
						{/each}
					</div>
				</fieldset>
			{/if}
			<label class="switch">
				<input type="checkbox" name="clientPrivate" checked={client.clientPrivate} />
				<span>{t('admin.client.private')}</span>
			</label>
			<p class="hint">{t('admin.client.privateHint')}</p>
			<fieldset class="field">
				<legend>{t('admin.client.download')}</legend>
				<label class="check"><input type="radio" name="clientDownloadMode" value="same" bind:group={client.mode} />{t('admin.client.downloadSame')}</label>
				<label class="check"><input type="radio" name="clientDownloadMode" value="custom" bind:group={client.mode} />{t('admin.client.downloadCustom')}</label>
				{#if client.mode === 'custom'}
					<div class="indent stack-sm">
						<label class="check"><input type="checkbox" name="cdEnabled" bind:checked={client.cd.enabled} />{t('admin.settings.photoDownload')}</label>
						<label class="check"><input type="checkbox" name="cdHighRes" bind:checked={client.cd.highRes} />{t('admin.settings.highRes')}</label>
						<label class="check"><input type="checkbox" name="cdWeb" bind:checked={client.cd.web} />{t('admin.settings.web')}</label>
					</div>
				{/if}
			</fieldset>
		{:else}
			<input type="hidden" name="clientPassword" value={client.clientPassword} />
		{/if}
		<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
	</form>

	<form class="card block" method="POST" action="?/expiry" use:enhance={saved}>
		<div class="title-row">
			<h3>{t('admin.settings.expiry')}</h3>
			{#if expired}<span class="badge failed">{t('admin.settings.expired')}</span>{/if}
		</div>
		<label class="field">
			<span>{t('admin.settings.expiresOn')}</span>
			<input type="date" name="expiresOn" bind:value={expiresOn} />
			<p class="hint">{t('admin.settings.expiresOnHint')}</p>
		</label>
		<label class="row"><input type="checkbox" name="reminder" bind:checked={reminder} disabled={!expiresOn} />{t('admin.settings.reminder')}</label>
		{#if reminder && expiresOn}
			<div class="two">
				<label class="field">
					<span>{t('admin.settings.reminderDays')}</span>
					<input type="number" name="reminderDays" min="1" max="365" value={gallery.reminderDays ?? 7} />
				</label>
				<label class="field">
					<span>{t('admin.settings.reminderTo')}</span>
					<select name="reminderTo" value={gallery.reminderTo}>
						<option value="client">{t('admin.settings.reminderToClient')}</option>
						<option value="all">{t('admin.settings.reminderToAll')}</option>
					</select>
				</label>
			</div>
			{#if gallery.reminderSentAt}
				<p class="hint">{t('admin.settings.reminderSent', { date: formatDate(gallery.reminderSentAt) })}</p>
			{/if}
		{/if}
		<div class="row">
			<button class="btn primary" type="submit">{t('common.save')}</button>
			{#if expiresOn}<button class="btn ghost" type="button" onclick={() => ((expiresOn = ''), (reminder = false))}>{t('admin.settings.noExpiry')}</button>{/if}
		</div>
	</form>

	<form class="card block" method="POST" action="?/watermark" use:enhance={saved}>
		<h3>{t('admin.settings.watermark')}</h3>
		<label class="field">
			<span class="visually-hidden">{t('admin.settings.watermark')}</span>
			<select name="watermarkId" value={gallery.watermarkId ?? ''} onchange={submitParent}>
				<option value="">{t('admin.settings.noWatermark')}</option>
				{#each watermarks as wm (wm.id)}<option value={wm.id}>{wm.name}</option>{/each}
			</select>
			<p class="hint">{t('admin.settings.watermarkHint')} <a href="/admin/settings?tab=watermarks">{t('admin.settings.manageWatermarks')}</a></p>
		</label>
	</form>

	<form class="card block" method="POST" action="?/download" use:enhance={saved}>
		<div class="title-row">
			<h3>{t('admin.settings.download')}</h3>
			<span class="badge" class:on={download.enabled}>{download.enabled ? t('common.on') : t('common.off')}</span>
		</div>
		<label class="switch">
			<input type="checkbox" name="enabled" bind:checked={download.enabled} />
			<span>{t('admin.settings.photoDownload')}</span>
		</label>
		<p class="hint">{t('admin.settings.photoDownloadHint')}</p>

		<fieldset class="sizes" disabled={!download.enabled}>
			<legend class="field-label">{t('admin.settings.sizes')}</legend>
			<p class="hint">{t('admin.settings.sizesHint')}</p>
			<div class="size-row">
				<label class="check"><input type="checkbox" name="highRes" bind:checked={download.highRes} />{t('admin.settings.highRes')}</label>
				<div class="radios">
					<label><input type="radio" name="highResSize" value="original" bind:group={download.highResSize} />{t('admin.settings.original')}</label>
					<label><input type="radio" name="highResSize" value="3600" bind:group={download.highResSize} />3600px</label>
				</div>
			</div>
			<div class="size-row">
				<label class="check"><input type="checkbox" name="web" bind:checked={download.web} />{t('admin.settings.web')}</label>
				<div class="radios">
					{#each ['2048', '1024', '640'] as size (size)}
						<label><input type="radio" name="webSize" value={size} bind:group={download.webSize} />{size}px</label>
					{/each}
				</div>
			</div>

			<legend class="field-label sub">{t('admin.settings.downloadRules')}</legend>
			<label class="row"><input type="checkbox" name="single" bind:checked={download.single} />{t('admin.settings.single')}</label>
			<label class="row"><input type="checkbox" name="requireEmail" bind:checked={download.requireEmail} />{t('admin.settings.requireEmail')}</label>
			{#if gallery.watermarkId}
				<label class="row"><input type="checkbox" name="watermarkWeb" bind:checked={download.watermarkWeb} />{t('admin.settings.watermarkWeb')}</label>
			{/if}

			<label class="field">
				<span>{t('admin.settings.pin')}</span>
				<div class="row nowrap">
					<input class="pin" type="text" name="pin" bind:value={download.pin} inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="––––" />
					<button class="btn" type="button" onclick={() => (download.pin = randomPin())}><RefreshCw size={14} />{t('common.generate')}</button>
					{#if download.pin}<button class="btn ghost" type="button" onclick={() => (download.pin = '')}>{t('admin.settings.removePin')}</button>{/if}
				</div>
				<p class="hint">{t('admin.settings.pinHint')}</p>
				{#if form?.section === 'download' && form.error === 'pin'}<p class="error-text">{t('admin.settings.pinInvalid')}</p>{/if}
			</label>

			<label class="row"><input type="checkbox" name="limitSections" bind:checked={limitSections} />{t('admin.settings.limitSections')}</label>
			{#if limitSections}
				<div class="section-list">
					{#each sections as section (section.id)}
						<label class="row"
							><input type="checkbox" name="sections" value={section.id} checked={!gallery.download.sections || gallery.download.sections.includes(section.id)} />{section.name}</label
						>
					{/each}
				</div>
			{/if}
		</fieldset>
		<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
	</form>

	<form class="card block" method="POST" action="?/store" use:enhance={saved}>
		<div class="title-row">
			<h3>{t('admin.store.title')}</h3>
			<span class="badge" class:on={gallery.storeEnabled && store.enabled}>{gallery.storeEnabled && store.enabled ? t('common.on') : t('common.off')}</span>
		</div>
		{#if !store.enabled}<p class="hint">{t('admin.galleryStore.globalOff')} <a href="/admin/store?tab=settings">{t('admin.nav.store')}</a></p>{/if}
		<label class="switch">
			<input type="checkbox" name="storeEnabled" checked={gallery.storeEnabled} />
			<span>{t('admin.galleryStore.enabled')}</span>
		</label>
		{#if store.priceLists.length === 0}
			<p class="hint">{t('admin.galleryStore.noPriceLists')} <a href="/admin/store?tab=pricelists">{t('admin.store.tab.pricelists')}</a></p>
		{:else}
			<label class="field">
				<span>{t('admin.galleryStore.priceList')}</span>
				<select name="priceListId" value={gallery.priceListId ?? ''}>
					<option value="">{t('admin.galleryStore.useDefault', { name: store.priceLists.find((l) => l.isDefault)?.name ?? '' })}</option>
					{#each store.priceLists as list (list.id)}<option value={list.id}>{list.name}</option>{/each}
				</select>
			</label>
		{/if}
		<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
	</form>

	<form class="card block" method="POST" action="?/favorites" use:enhance={saved}>
		<div class="title-row">
			<h3>{t('admin.settings.favorites')}</h3>
			<span class="badge" class:on={gallery.favoritesEnabled}>{gallery.favoritesEnabled ? t('common.on') : t('common.off')}</span>
		</div>
		<label class="switch">
			<input type="checkbox" name="enabled" checked={gallery.favoritesEnabled} onchange={submitParent} />
			<span>{t('admin.settings.favoritePhotos')}</span>
		</label>
		<p class="hint">{t('admin.settings.favoritePhotosHint')} <a href="?tab=activity" data-sveltekit-noscroll>{t('admin.settings.seeActivity')}</a></p>
		<label class="switch">
			<input type="checkbox" name="listSharing" checked={gallery.access.listSharing} onchange={submitParent} />
			<span>{t('admin.lists.sharing')}</span>
		</label>
		<p class="hint">{t('admin.lists.sharingHint')}</p>
		<label class="switch">
			<input type="checkbox" name="privateShareDefault" checked={gallery.access.privateShareDefault} onchange={submitParent} />
			<span>{t('admin.lists.privateDefault')}</span>
		</label>
		<p class="hint">{t('admin.lists.privateDefaultHint')}</p>

		<fieldset class="field">
			<legend>{t('admin.lists.presets')}</legend>
			<p class="hint">{t('admin.lists.presetsHint')}</p>
			<input type="hidden" name="lists" value={listsJson} />
			{#each lists as list, i (list.id)}
				<div class="row nowrap">
					<input type="text" bind:value={list.name} maxlength="60" placeholder={t('admin.lists.namePlaceholder')} aria-label={t('common.name')} />
					<input class="limit" type="number" min="1" max="9999" bind:value={list.limit} placeholder={t('admin.lists.noLimit')} aria-label={t('admin.lists.limit')} />
					<button class="btn ghost" type="button" onclick={() => lists.splice(i, 1)} aria-label={t('common.delete')}>×</button>
				</div>
			{/each}
			<div class="row">
				<button class="btn" type="button" onclick={() => lists.push({ id: crypto.randomUUID(), name: '', limit: '' })}>{t('admin.lists.add')}</button>
				<button class="btn primary" type="submit">{t('common.save')}</button>
			</div>
		</fieldset>
	</form>
</div>

<style>
	.settings {
		max-width: 760px;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 22px 24px;
	}

	h3 {
		font-size: 1rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.url {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.prefix {
		display: flex;
		align-items: center;
		padding: 0 4px 0 12px;
		background: var(--admin-bg);
		color: var(--muted);
		font-size: 0.875rem;
		white-space: nowrap;
		max-width: 55%;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.url input {
		border: 0 !important;
		border-radius: 0 !important;
		box-shadow: none !important;
	}

	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	.option {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.option .hint {
		padding-left: 50px;
	}

	.nowrap {
		flex-wrap: nowrap;
	}

	.sizes {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.sizes:disabled {
		opacity: 0.5;
	}

	.sub {
		margin-top: 8px;
	}

	.size-row {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 150px;
		font-weight: 500;
	}

	.radios {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
	}

	.radios label {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	input[type='checkbox']:not(.switch input),
	input[type='radio'] {
		width: 16px;
		height: 16px;
		accent-color: var(--accent);
	}

	.pin {
		max-width: 120px;
		letter-spacing: 0.3em;
		text-align: center;
	}

	.section-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-left: 26px;
	}

	@media (max-width: 640px) {
		.two {
			grid-template-columns: 1fr;
		}
	}

	.indent {
		padding-left: 26px;
	}

	.stack-sm {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.limit {
		max-width: 130px;
	}
</style>
