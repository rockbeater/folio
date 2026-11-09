<script lang="ts">
	import { enhance } from '$app/forms';
	import Copy from '@lucide/svelte/icons/copy';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { randomPassword } from '$lib/admin-actions';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { EditorGallery } from './editor-types';

	interface Props {
		gallery: EditorGallery;
		baseUrl: string;
		favorites: { email: string; files: string[] }[];
		form: { error?: string; section?: string } | null;
	}

	let { gallery, baseUrl, favorites, form }: Props = $props();
	const { t, plural } = useI18n();

	// svelte-ignore state_referenced_locally
	let password = $state(gallery.password ?? '');
	// svelte-ignore state_referenced_locally
	let download = $state({ ...gallery.download });

	const saved: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') toast(t('common.saved'));
		};
	};

	/** Auto-submit the surrounding form when a switch changes. */
	function submitParent(event: Event) {
		(event.currentTarget as HTMLInputElement).form?.requestSubmit();
	}

	async function copyFiles(files: string[]) {
		await navigator.clipboard.writeText(files.join(', '));
		toast(t('admin.settings.filenamesCopied'));
	}
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
		<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
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
		<div><button class="btn primary" type="submit">{t('common.save')}</button></div>
	</form>

	<form class="card block" method="POST" action="?/download" use:enhance={saved}>
		<div class="title-row">
			<h3>{t('admin.settings.download')}</h3>
			<span class="badge" class:on={download.enabled}>{download.enabled ? t('common.on') : t('common.off')}</span>
		</div>
		<label class="switch">
			<input type="checkbox" name="enabled" bind:checked={download.enabled} onchange={submitParent} />
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
		</fieldset>
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
		<p class="hint">{t('admin.settings.favoritePhotosHint')}</p>

		<h4 class="field-label">{t('admin.settings.favoritesBy')}</h4>
		{#if favorites.length === 0}
			<p class="hint">{t('admin.settings.favoritesNone')}</p>
		{:else}
			<ul class="favs">
				{#each favorites as fav (fav.email)}
					<li>
						<div>
							<strong>{fav.email}</strong>
							<span class="hint">{plural('common.photos', fav.files.length)}</span>
						</div>
						<button class="btn small" type="button" onclick={() => copyFiles(fav.files)}>
							<Copy size={14} />{t('admin.settings.copyFilenames')}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
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

	h4 {
		margin: 8px 0 0;
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

	.favs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.favs li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 12px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	.favs li div {
		display: flex;
		flex-direction: column;
	}

	@media (max-width: 640px) {
		.two {
			grid-template-columns: 1fr;
		}
	}
</style>
