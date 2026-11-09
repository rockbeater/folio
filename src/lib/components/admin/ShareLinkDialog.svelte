<script lang="ts">
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Modal from '$lib/components/Modal.svelte';
	import { callAction, randomPassword } from '$lib/admin-actions';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';

	interface LinkValues {
		id?: string;
		name: string;
		download: { enabled: boolean; highRes: boolean; web: boolean };
		expiresOn: string | null;
		password: string | null;
	}

	interface Props {
		/** Photos for a new link; ignored when editing. */
		photoIds?: string[];
		link?: LinkValues & { token: string };
		baseUrl: string;
		onclose: () => void;
	}

	let { photoIds = [], link, baseUrl, onclose }: Props = $props();
	const { t, plural } = useI18n();

	// svelte-ignore state_referenced_locally
	let values = $state({
		name: link?.name ?? '',
		dlEnabled: link?.download.enabled ?? false,
		dlHighRes: link?.download.highRes ?? true,
		dlWeb: link?.download.web ?? true,
		expiresOn: link?.expiresOn ?? '',
		password: link?.password ?? ''
	});
	// svelte-ignore state_referenced_locally
	let token = $state(link?.token ?? '');
	let busy = $state(false);
	const url = $derived(token ? `${baseUrl}/q/${token}` : '');

	async function save(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		const result = link
			? await callAction('updateLink', { id: link.id, ...values })
			: await callAction('createLink', { ids: photoIds, ...values });
		busy = false;
		if (result.type !== 'success') {
			toast(t('common.error'), 'error');
			return;
		}
		if (link) {
			toast(t('common.saved'));
			onclose();
		} else {
			token = String((result.data as { linkToken?: string } | undefined)?.linkToken ?? '');
		}
	}

	async function copy() {
		await navigator.clipboard.writeText(url);
		toast(t('admin.editor.linkCopied'));
	}
</script>

<Modal title={link ? t('admin.links.edit') : t('admin.links.create')} {onclose}>
	{#if token && !link}
		<div class="stack">
			<p>{t('admin.links.created')}</p>
			<div class="row nowrap">
				<input readonly value={url} onfocus={(e) => e.currentTarget.select()} aria-label={t('admin.links.url')} />
				<button class="btn primary" type="button" onclick={copy}>{t('common.copy')}</button>
			</div>
			{#if values.password}<p class="hint">{t('admin.links.passwordNote', { password: values.password })}</p>{/if}
			<div><button class="btn" type="button" onclick={onclose}>{t('common.close')}</button></div>
		</div>
	{:else}
		<form class="stack" onsubmit={save}>
			{#if !link}<p class="hint">{t('admin.links.intro', { photos: plural('common.photos', photoIds.length) })}</p>{/if}
			<label class="field">
				<span>{t('common.name')}</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input bind:value={values.name} required maxlength="100" placeholder={t('admin.links.namePlaceholder')} autofocus />
			</label>
			<label class="switch">
				<input type="checkbox" bind:checked={values.dlEnabled} />
				<span>{t('admin.links.download')}</span>
			</label>
			{#if values.dlEnabled}
				<div class="row">
					<label class="check"><input type="checkbox" bind:checked={values.dlHighRes} />{t('admin.settings.highRes')}</label>
					<label class="check"><input type="checkbox" bind:checked={values.dlWeb} />{t('admin.settings.web')}</label>
				</div>
			{/if}
			<label class="field">
				<span>{t('admin.links.expiresOn')} <small class="hint">({t('common.optional')})</small></span>
				<input type="date" bind:value={values.expiresOn} />
			</label>
			<label class="field">
				<span>{t('common.password')} <small class="hint">({t('common.optional')})</small></span>
				<div class="row nowrap">
					<input type="text" bind:value={values.password} autocomplete="off" spellcheck="false" />
					<button class="btn" type="button" onclick={() => (values.password = randomPassword())}><RefreshCw size={14} />{t('common.generate')}</button>
				</div>
			</label>
			<p class="hint">{t('admin.links.independent')}</p>
			<div class="row">
				<button class="btn primary" type="submit" disabled={busy || !values.name.trim()}>{link ? t('common.save') : t('admin.links.create')}</button>
				<button class="btn ghost" type="button" onclick={onclose}>{t('common.cancel')}</button>
			</div>
		</form>
	{/if}
</Modal>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
</style>
