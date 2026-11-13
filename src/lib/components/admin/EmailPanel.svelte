<script lang="ts">
	import { enhance } from '$app/forms';
	import Eye from '@lucide/svelte/icons/eye';
	import Send from '@lucide/svelte/icons/send';
	import Copy from '@lucide/svelte/icons/copy';
	import { LANGUAGE_NAMES, type Language } from '$lib/types';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Modal from '$lib/components/Modal.svelte';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { EditorGallery } from './editor-types';

	interface Template {
		id: string;
		name: string;
		language: string;
		subject: string;
		body: string;
		isDefault: boolean;
	}

	interface LogEntry {
		id: string;
		kind: 'gallery' | 'reminder' | 'test';
		recipient: string;
		scheduledFor: number | null;
		subject: string;
		status: 'queued' | 'sent' | 'failed';
		error: string | null;
		createdAt: number;
		sentAt: number | null;
	}

	interface Props {
		gallery: EditorGallery;
		templates: Template[];
		defaultTemplateId: string | null;
		log: LogEntry[];
		smtpConfigured: boolean;
		adminEmail: string;
		form: Record<string, unknown> | null;
	}

	let { gallery, templates, defaultTemplateId, log, smtpConfigured, adminEmail, form }: Props = $props();
	const { t, lang } = useI18n();

	// svelte-ignore state_referenced_locally
	const initial = templates.find((tpl) => tpl.id === defaultTemplateId) ?? templates.find((tpl) => tpl.isDefault) ?? templates[0];
	let later = $state(false);
	let sendAt = $state('');
	const multipleLanguages = $derived(new Set(templates.map((tpl) => tpl.language)).size > 1);
	let templateId = $state(initial?.id ?? '');
	let subject = $state(initial?.subject ?? '');
	let body = $state(initial?.body ?? '');
	// svelte-ignore state_referenced_locally
	let recipients = $state(gallery.clientEmail ?? '');
	let includePassword = $state(true);
	let includeClientPassword = $state(true);
	const hasClientPassword = $derived(gallery.access.clientEnabled && Boolean(gallery.access.clientPassword));
	let publish = $state(true);
	let busy = $state(false);
	let preview = $state<{ subject: string; html: string } | null>(null);

	const errors = $derived((form?.emailErrors as Record<string, string> | undefined) ?? {});

	function chooseTemplate() {
		const tpl = templates.find((x) => x.id === templateId);
		if (tpl) {
			subject = tpl.subject;
			body = tpl.body;
		}
	}

	async function showPreview() {
		const res = await fetch(`/admin/api/galleries/${gallery.id}/email-preview`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ subject, body, includePassword, includeClientPassword: hasClientPassword && includeClientPassword })
		});
		if (res.ok) preview = await res.json();
		else toast(t('common.error'), 'error');
	}

	/** Copy the invitation as plain text, for SMS or messaging apps. */
	async function copyInvitation() {
		const res = await fetch(`/admin/api/galleries/${gallery.id}/email-preview`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ subject, body, includePassword, includeClientPassword: hasClientPassword && includeClientPassword })
		});
		if (!res.ok) return toast(t('common.error'), 'error');
		const data = (await res.json()) as { invitation: string };
		await navigator.clipboard.writeText(data.invitation);
		toast(t('admin.email.invitationCopied'));
	}

	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			busy = false;
			if (result.type === 'success') {
				const data = result.data as { queued?: number; testSent?: string; scheduled?: boolean; ok?: boolean } | undefined;
				if (data?.testSent) toast(t('admin.email.testQueued', { email: data.testSent }));
				else if (data?.scheduled) toast(t('admin.email.scheduled'));
				else if (data?.queued) toast(t('admin.email.queued'));
				else if (data?.ok) toast(t('common.saved'));
			} else if (result.type === 'failure' && result.data?.testError) {
				toast(t('admin.smtp.testFailed', { error: String(result.data.testError) }), 'error', 8000);
			}
		};
	};

	const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<div class="email stack">
	{#if !smtpConfigured}
		<div class="alert">
			<TriangleAlert size={18} />
			<p>{t('admin.email.notConfigured')} <a href="/admin/settings?tab=email">{t('admin.email.configure')}</a></p>
		</div>
	{/if}

	<form class="card block" method="POST" action="?/sendEmail" use:enhance={submit}>
		<h3>{t('admin.email.title')}</h3>
		<input type="hidden" name="templateId" value={templateId} />

		<label class="field">
			<span>{t('admin.email.recipients')}</span>
			<input type="text" name="recipients" bind:value={recipients} autocomplete="off" inputmode="email" />
			<p class="hint">{t('admin.email.recipientsHint')}</p>
			{#if errors.recipients}<p class="error-text">{t(errors.recipients as MessageKey)}</p>{/if}
		</label>

		{#if templates.length > 1}
			<label class="field">
				<span>{t('admin.email.template')}</span>
				<select bind:value={templateId} onchange={chooseTemplate}>
					{#each templates as tpl (tpl.id)}
						<option value={tpl.id}>{tpl.name}{multipleLanguages ? ` (${LANGUAGE_NAMES[tpl.language as Language] ?? tpl.language})` : ''}</option>
					{/each}
				</select>
			</label>
		{/if}

		<label class="field">
			<span>{t('admin.email.subject')}</span>
			<input type="text" name="subject" bind:value={subject} />
			{#if errors.subject}<p class="error-text">{t(errors.subject as MessageKey)}</p>{/if}
		</label>

		<label class="field">
			<span>{t('admin.email.message')}</span>
			<textarea name="body" bind:value={body} rows="10"></textarea>
			<p class="hint">{t('admin.email.messageHint')}</p>
		</label>

		{#if gallery.password}
			<label class="row"><input type="checkbox" name="includePassword" bind:checked={includePassword} />{t('admin.email.includePassword')}</label>
		{/if}
		{#if hasClientPassword}
			<label class="row"><input type="checkbox" name="includeClientPassword" bind:checked={includeClientPassword} />{t('admin.email.includeClientPassword')}</label>
		{/if}
		{#if gallery.status !== 'published'}
			<label class="row"><input type="checkbox" name="publish" bind:checked={publish} />{t('admin.email.publishAndSend')}</label>
		{/if}
		<label class="row"><input type="checkbox" name="later" bind:checked={later} />{t('admin.email.sendLater')}</label>
		{#if later}
			<label class="field">
				<span>{t('admin.email.sendAt')}</span>
				<input type="datetime-local" name="sendAt" bind:value={sendAt} />
				{#if errors.sendAt}<p class="error-text">{t(errors.sendAt as MessageKey)}</p>{/if}
			</label>
		{/if}

		<div class="row actions">
			<button class="btn ghost" type="button" onclick={copyInvitation}><Copy size={16} />{t('admin.email.copyInvitation')}</button>
			<button class="btn" type="button" onclick={showPreview}><Eye size={16} />{t('admin.email.preview')}</button>
			{#if adminEmail}
				<button class="btn" type="submit" name="mode" value="test" disabled={busy || !smtpConfigured}>{t('admin.email.sendTest')}</button>
			{/if}
			<button class="btn primary" type="submit" name="mode" value="send" disabled={busy || !smtpConfigured || (later && !sendAt)}>
				<Send size={16} />{later ? t('admin.email.schedule') : t('admin.email.send')}
			</button>
		</div>
	</form>

	<section class="card block">
		<h3>{t('admin.email.log')}</h3>
		{#if log.length === 0}
			<p class="hint">{t('admin.email.logEmpty')}</p>
		{:else}
			<ul class="log">
				{#each log as entry (entry.id)}
					<li>
						<div class="who">
							<strong>{entry.recipient}</strong>
							<span class="hint">{entry.kind === 'reminder' ? `${t('admin.email.reminder')} · ` : ''}{entry.subject}</span>
							{#if entry.status === 'failed' && entry.error}<span class="error-text">{entry.error}</span>{/if}
						</div>
						<span class="hint when">{dateFormat.format(entry.sentAt ?? entry.scheduledFor ?? entry.createdAt)}</span>
						{#if entry.status === 'queued' && entry.scheduledFor}
							<span class="badge queued">{t('admin.email.status.scheduled')}</span>
							<form method="POST" action="?/cancelEmail" use:enhance={submit}>
								<input type="hidden" name="id" value={entry.id} />
								<button class="btn small ghost" type="submit">{t('common.cancel')}</button>
							</form>
						{:else}
							<span class="badge {entry.status}">{t(`admin.email.status.${entry.status}` as MessageKey)}</span>
							<form method="POST" action="?/resend" use:enhance={submit}>
								<input type="hidden" name="id" value={entry.id} />
								<button class="btn small ghost" type="submit">{t('admin.email.resend')}</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

{#if preview}
	<Modal title={preview.subject} onclose={() => (preview = null)} wide>
		<iframe class="preview" title={t('admin.email.preview')} srcdoc={preview.html} sandbox="allow-same-origin"></iframe>
	</Modal>
{/if}

<style>
	.email {
		max-width: 760px;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 22px 24px;
	}

	h3 {
		font-size: 1rem;
	}

	.row input[type='checkbox'] {
		width: 16px;
		height: 16px;
		accent-color: var(--accent);
	}

	.actions {
		justify-content: flex-end;
	}

	.log {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.log li {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}

	.log li:first-child {
		border-top: 0;
	}

	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.who span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.log form {
		margin: 0;
	}

	.preview {
		width: 100%;
		height: 70vh;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: #f4f4f2;
	}

	@media (max-width: 640px) {
		.log li {
			grid-template-columns: 1fr auto;
		}

		.when {
			display: none;
		}
	}
</style>
