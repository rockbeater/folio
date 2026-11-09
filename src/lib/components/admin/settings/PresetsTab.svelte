<script lang="ts">
	import { enhance } from '$app/forms';
	import { useI18n } from '$lib/i18n';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { presets, saved }: { presets: { id: string; name: string; isDefault: boolean }[]; saved: SubmitFunction } = $props();
	const { t } = useI18n();
	let renaming = $state<string | null>(null);
</script>

<p class="hint intro">{t('admin.presets.intro')}</p>

{#if presets.length === 0}
	<div class="card empty"><p class="hint">{t('admin.presets.empty')}</p></div>
{:else}
	<ul class="list">
		{#each presets as preset (preset.id)}
			<li class="card">
				{#if renaming === preset.id}
					<form method="POST" action="?/renamePreset" class="row grow" use:enhance={(input) => { const after = saved(input); renaming = null; return after; }}>
						<input type="hidden" name="id" value={preset.id} />
						<input type="text" name="name" value={preset.name} required aria-label={t('common.name')} />
						<button class="btn small primary" type="submit">{t('common.save')}</button>
					</form>
				{:else}
					<div class="name">
						<strong>{preset.name}</strong>
						{#if preset.isDefault}<span class="badge on">{t('admin.presets.default')}</span>{/if}
					</div>
					<div class="row">
						<form method="POST" action="?/defaultPreset" use:enhance={saved}>
							<input type="hidden" name="id" value={preset.isDefault ? '' : preset.id} />
							<button class="btn small ghost" type="submit">{preset.isDefault ? t('admin.presets.unsetDefault') : t('admin.presets.makeDefault')}</button>
						</form>
						<button class="btn small" type="button" onclick={() => (renaming = preset.id)}>{t('common.rename')}</button>
						<form
							method="POST"
							action="?/deletePreset"
							use:enhance={(input) => {
								if (!confirm(t('admin.presets.deleteConfirm', { name: preset.name }))) input.cancel();
								return saved(input);
							}}
						>
							<input type="hidden" name="id" value={preset.id} />
							<button class="btn small ghost danger" type="submit">{t('common.delete')}</button>
						</form>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.intro {
		margin-bottom: 16px;
	}

	.empty {
		padding: 24px;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 14px 16px;
	}

	.list form {
		margin: 0;
	}

	.name {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.grow {
		flex: 1;
	}

	.grow input {
		flex: 1;
	}
</style>
