<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { LANGUAGE_NAMES, type Language } from '$lib/types';
	import type { SubmitFunction } from '@sveltejs/kit';

	interface Template {
		id: string;
		kind: 'delivery' | 'reminder';
		language: string;
		name: string;
		subject: string;
		body: string;
		isDefault: boolean;
	}

	let { templates, languages, defaultLanguage, saved }: { templates: Template[]; languages: string[]; defaultLanguage: string; saved: SubmitFunction } =
		$props();
	const { t } = useI18n();

	let editing = $state<Omit<Template, 'isDefault'> | null>(null);
	const kinds = ['delivery', 'reminder'] as const;
	const languageName = (lang: string) => LANGUAGE_NAMES[lang as Language] ?? lang;

	const done: SubmitFunction = async (input) => {
		const after = await saved(input);
		return async (opts) => {
			if (typeof after === 'function') await after(opts);
			else await opts.update();
			if (opts.result.type === 'success') editing = null;
		};
	};
</script>

<p class="hint intro">{t('admin.templates.intro')}</p>

{#each kinds as kind (kind)}
	<h2 class="group">{t(`admin.templates.kind.${kind}` as MessageKey)}</h2>
	<p class="hint">{t(`admin.templates.kindHint.${kind}` as MessageKey)}</p>
	<ul class="templates">
		{#each templates.filter((tpl) => tpl.kind === kind) as tpl (tpl.id)}
			<li class="card">
				<div class="tpl-head">
					<div>
						<strong>{tpl.name}</strong>
						{#if languages.length > 1}<span class="badge">{languageName(tpl.language)}</span>{/if}
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
							use:enhance={(input) => {
								if (!confirm(t('admin.templates.deleteConfirm', { name: tpl.name }))) input.cancel();
								return saved(input);
							}}
						>
							<input type="hidden" name="id" value={tpl.id} />
							<button class="btn small ghost danger" type="submit">{t('common.delete')}</button>
						</form>
					</div>
				</div>
				{#if editing?.id === tpl.id}{@render editor()}{/if}
			</li>
		{/each}
	</ul>
	{#if editing && !editing.id && editing.kind === kind}
		<div class="card new">{@render editor()}</div>
	{:else}
		<button
			class="btn"
			type="button"
			onclick={() => (editing = { id: '', kind, language: defaultLanguage, name: '', subject: '', body: '' })}
		>
			<Plus size={16} />{t('admin.templates.new')}
		</button>
	{/if}
{/each}

{#snippet editor()}
	{#if editing}
		<form class="stack tpl-form" method="POST" action="?/saveTemplate" use:enhance={done}>
			<input type="hidden" name="id" value={editing.id} />
			<input type="hidden" name="kind" value={editing.kind} />
			<div class="two">
				<label class="field">
					<span>{t('common.name')}</span>
					<input type="text" name="name" bind:value={editing.name} required />
				</label>
				<label class="field">
					<span>{t('admin.settings.language')}</span>
					<select name="language" bind:value={editing.language}>
						{#each languages as lang (lang)}<option value={lang}>{languageName(lang)}</option>{/each}
					</select>
				</label>
			</div>
			<label class="field">
				<span>{t('admin.email.subject')}</span>
				<input type="text" name="subject" bind:value={editing.subject} />
			</label>
			<label class="field">
				<span>{t('admin.email.message')}</span>
				<textarea name="body" bind:value={editing.body} rows="10"></textarea>
				<p class="hint">{t('admin.email.messageHint')} {t('admin.templates.expiryField')}</p>
			</label>
			<div class="row">
				<button class="btn primary" type="submit">{t('common.save')}</button>
				<button class="btn ghost" type="button" onclick={() => (editing = null)}>{t('common.cancel')}</button>
			</div>
		</form>
	{/if}
{/snippet}

<style>
	.intro {
		margin-bottom: 8px;
	}

	.group {
		margin-top: 24px;
		font-size: 1.0625rem;
	}

	.templates {
		list-style: none;
		margin: 12px 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.templates li,
	.new {
		padding: 16px 18px;
	}

	.new {
		margin-bottom: 12px;
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

	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	@media (max-width: 640px) {
		.two {
			grid-template-columns: 1fr;
		}
	}
</style>
