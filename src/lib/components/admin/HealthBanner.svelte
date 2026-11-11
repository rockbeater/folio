<script lang="ts">
	import CircleX from '@lucide/svelte/icons/circle-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import type { CheckResult } from '$lib/server/health';

	/** What the self-check found, errors first. */
	let { problems }: { problems: CheckResult[] } = $props();
	const { t, lang } = useI18n();
	// Numbers in messages with the language's decimal mark (27,5 GB in Danish).
	const number = $derived(new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }));
	const local = (params: Record<string, string | number> | undefined) =>
		Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, typeof v === 'number' ? number.format(v) : v]));

	// Warnings can be hidden until something changes; errors always show.
	const KEY = 'folio-health-hidden';
	const signature = $derived(problems.map((p) => `${p.id}:${p.status}:${p.message}`).join('|'));
	const onlyWarnings = $derived(problems.every((p) => p.status === 'warn'));
	let hidden = $state('');
	$effect(() => {
		try {
			hidden = localStorage.getItem(KEY) ?? '';
		} catch {
			// storage unavailable: always show
		}
	});

	function hide() {
		hidden = signature;
		try {
			localStorage.setItem(KEY, signature);
		} catch {
			// ignore
		}
	}

	const first = $derived(problems[0]);
	const show = $derived(problems.length > 0 && !(onlyWarnings && hidden === signature));
</script>

{#if show && first}
	<div class="health" class:error={first.status === 'error'} role="alert">
		<span class="icon">{#if first.status === 'error'}<CircleX size={18} />{:else}<TriangleAlert size={18} />{/if}</span>
		<p>
			<strong>{t(`health.name.${first.id}` as MessageKey)}:</strong>
			{t(first.message, local(first.params))}
			{#if problems.length > 1}<span class="more">{t('admin.system.more', { count: problems.length - 1 })}</span>{/if}
		</p>
		<a class="details" href="/admin/settings?tab=system">{t('admin.system.details')}</a>
		{#if onlyWarnings}
			<button class="close" type="button" onclick={hide} aria-label={t('admin.system.hide')} title={t('admin.system.hide')}><X size={16} /></button>
		{/if}
	</div>
{/if}

<style>
	.health {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 20px;
		border-bottom: 1px solid var(--line);
		background: var(--warning-soft);
		color: var(--text);
		font-size: 0.875rem;
	}

	.health.error {
		background: var(--danger-soft);
	}

	.icon {
		display: flex;
		flex-shrink: 0;
		color: var(--warning);
	}

	.error .icon {
		color: var(--danger);
	}

	p {
		flex: 1;
		min-width: 0;
		margin: 0;
		line-height: 1.45;
	}

	.more {
		margin-left: 6px;
		color: var(--muted);
		white-space: nowrap;
	}

	.details {
		flex-shrink: 0;
		color: var(--text);
		font-weight: 500;
		white-space: nowrap;
	}

	.close {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--muted);
	}

	.close:hover {
		background: rgba(0, 0, 0, 0.06);
	}
</style>
