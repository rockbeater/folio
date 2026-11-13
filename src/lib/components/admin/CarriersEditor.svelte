<script lang="ts">
	import { enhance } from '$app/forms';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { DEFAULT_CARRIERS, TRACKING_PLACEHOLDER, trackingUrl, type Carrier } from '$lib/carriers';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';

	let { carriers }: { carriers: Carrier[] } = $props();
	const { t } = useI18n();

	// svelte-ignore state_referenced_locally
	let rows = $state<Carrier[]>(carriers.map((c) => ({ ...c })));
	let testNumber = $state('');

	function add() {
		rows.push({ id: '', name: '', url: '' });
	}

	function reset() {
		if (confirm(t('admin.carriers.resetConfirm'))) rows = DEFAULT_CARRIERS.map((c) => ({ ...c }));
	}

	/** Open the tracking page with a number, to see that the address still works. */
	const testLink = (c: Carrier) => trackingUrl([c], c.id, testNumber.trim() || 'TEST123');
</script>

<form
	class="card block"
	method="POST"
	action="?/saveCarriers"
	use:enhance={() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') toast(t('common.saved'));
			else toast(t('common.error'), 'error');
		}}
>
	<div>
		<h3>{t('admin.carriers.title')}</h3>
		<p class="hint">{t('admin.carriers.intro', { placeholder: TRACKING_PLACEHOLDER })}</p>
	</div>

	<label class="field test">
		<span>{t('admin.carriers.testNumber')}</span>
		<input type="text" bind:value={testNumber} placeholder="TEST123" autocomplete="off" />
	</label>

	<ul class="rows">
		{#each rows as row, i (i)}
			<li>
				<input type="text" bind:value={row.name} placeholder={t('common.name')} aria-label={t('common.name')} maxlength="60" />
				<input type="url" bind:value={row.url} placeholder="https://…/{TRACKING_PLACEHOLDER}" aria-label={t('admin.carriers.url')} />
				{#if testLink(row)}
					<a class="icon-btn" href={testLink(row)} target="_blank" rel="noopener noreferrer" title={t('admin.carriers.test')} aria-label={t('admin.carriers.test')}><ExternalLink size={16} /></a>
				{:else}
					<span class="icon-btn placeholder" aria-hidden="true"></span>
				{/if}
				<button class="icon-btn" type="button" onclick={() => rows.splice(i, 1)} title={t('common.delete')} aria-label={t('common.delete')}><Trash size={16} /></button>
			</li>
		{/each}
	</ul>

	<input type="hidden" name="carriers" value={JSON.stringify(rows)} />
	<div class="row">
		<button class="btn" type="button" onclick={add}><Plus size={16} />{t('admin.carriers.add')}</button>
		<button class="btn ghost" type="button" onclick={reset}>{t('admin.carriers.reset')}</button>
		<button class="btn primary" type="submit">{t('common.save')}</button>
	</div>
</form>

<style>
	.test {
		max-width: 280px;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: minmax(120px, 1fr) minmax(0, 3fr) 36px 36px;
		align-items: center;
		gap: 8px;
	}

	.placeholder {
		visibility: hidden;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	@media (max-width: 600px) {
		li {
			grid-template-columns: minmax(0, 1fr) 36px 36px;
		}

		li input[type='url'] {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
