<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts, dismissToast } from '$lib/toast.svelte';
</script>

<div class="toasts" role="status" aria-live="polite">
	{#each toasts as item (item.id)}
		<button
			type="button"
			class="toast"
			class:error={item.tone === 'error'}
			transition:fly={{ y: 16, duration: 200 }}
			onclick={() => dismissToast(item.id)}
		>
			{item.message}
		</button>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		left: 50%;
		bottom: calc(var(--space-5) + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		z-index: 1000;
		pointer-events: none;
		width: max-content;
		max-width: calc(100vw - 32px);
	}

	.toast {
		pointer-events: auto;
		border: 0;
		background: #1e1e1e;
		color: #ffffff;
		font-family: var(--sans);
		font-size: 0.875rem;
		padding: 12px 20px;
		text-align: center;
	}

	.toast.error {
		background: #7a2b20;
	}
</style>
