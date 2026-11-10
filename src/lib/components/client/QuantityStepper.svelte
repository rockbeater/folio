<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { useI18n } from '$lib/i18n';

	let {
		value = $bindable(1),
		max = 99,
		onchange
	}: { value?: number; max?: number; onchange?: (value: number) => void } = $props();
	const { t } = useI18n();

	function set(next: number) {
		const n = Math.min(max, Math.max(1, Math.floor(next) || 1));
		if (n === value) return;
		value = n;
		onchange?.(n);
	}
</script>

<div class="stepper">
	<button type="button" aria-label={t('store.decrease')} disabled={value <= 1} onclick={() => set(value - 1)}><Minus size={16} strokeWidth={1.5} /></button>
	<input
		class="tabular"
		type="number"
		inputmode="numeric"
		min="1"
		{max}
		aria-label={t('store.quantity')}
		{value}
		onchange={(e) => {
			set(Number(e.currentTarget.value));
			e.currentTarget.value = String(value);
		}}
	/>
	<button type="button" aria-label={t('store.increase')} disabled={value >= max} onclick={() => set(value + 1)}><Plus size={16} strokeWidth={1.5} /></button>
</div>

<style>
	.stepper {
		display: inline-flex;
		align-self: flex-start;
		align-items: stretch;
		height: 44px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
	}

	button {
		display: grid;
		place-items: center;
		width: 44px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-text);
	}

	button:disabled {
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	input {
		width: 48px;
		padding: 0;
		border: 0;
		border-inline: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		text-align: center;
		-moz-appearance: textfield;
		appearance: textfield;
	}

	input::-webkit-inner-spin-button,
	input::-webkit-outer-spin-button {
		margin: 0;
		-webkit-appearance: none;
	}
</style>
