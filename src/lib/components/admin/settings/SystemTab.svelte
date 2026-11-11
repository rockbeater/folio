<script lang="ts">
	import { enhance } from '$app/forms';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleMinus from '@lucide/svelte/icons/circle-minus';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import type { CheckResult } from '$lib/server/health';

	let { results }: { results: CheckResult[] } = $props();
	const { t, lang } = useI18n();
	// Numbers in messages with the language's decimal mark (27,5 GB in Danish).
	const number = $derived(new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }));
	const local = (params: Record<string, string | number> | undefined) =>
		Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, typeof v === 'number' ? number.format(v) : v]));
	let checking = $state(false);

	const ICON = { ok: CircleCheck, warn: TriangleAlert, error: CircleX, off: CircleMinus };
	const time = $derived(new Intl.DateTimeFormat(lang, { timeStyle: 'short' }));
</script>

<section class="card block">
	<div class="head">
		<div>
			<h3>{t('admin.system.title')}</h3>
			<p class="hint">{t('admin.system.intro')}</p>
		</div>
		<form
			method="POST"
			action="?/healthCheck"
			use:enhance={() => {
				checking = true;
				return async ({ update }) => {
					await update({ reset: false });
					checking = false;
				};
			}}
		>
			<button class="btn" type="submit" disabled={checking}><RefreshCw size={16} class={checking ? 'spin' : ''} />{t('admin.system.checkNow')}</button>
		</form>
	</div>

	{#if results.length === 0}
		<p class="hint">{t('admin.system.notRun')}</p>
	{:else}
		<ul class="checks">
			{#each results as r (r.id)}
				{@const Icon = ICON[r.status]}
				<li class={r.status}>
					<span class="icon" title={t(`health.status.${r.status}` as MessageKey)}><Icon size={18} /></span>
					<div class="body">
						<strong>{t(`health.name.${r.id}` as MessageKey)}</strong>
						<p>{t(r.message, local(r.params))}</p>
					</div>
					<span class="when hint">{t('admin.system.checked', { time: time.format(r.checkedAt) })}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	h3 {
		margin: 0 0 4px;
	}

	.checks {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 0;
		border-top: 1px solid var(--line);
	}

	.icon {
		flex-shrink: 0;
		margin-top: 1px;
		color: var(--muted);
	}

	.ok .icon {
		color: var(--success);
	}

	.warn .icon {
		color: var(--warning);
	}

	.error .icon {
		color: var(--danger);
	}

	.body {
		flex: 1;
		min-width: 0;
	}

	.body p {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 0.875rem;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.error .body p {
		color: var(--text);
	}

	.when {
		flex-shrink: 0;
		white-space: nowrap;
	}

	@media (max-width: 600px) {
		li {
			flex-wrap: wrap;
		}

		.when {
			width: 100%;
			padding-left: 30px;
		}
	}
</style>
