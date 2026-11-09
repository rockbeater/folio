<script lang="ts">
	import type { Snippet } from 'svelte';
	import '$lib/styles/admin.css';

	let { title, intro, children }: { title: string; intro?: string; children: Snippet } = $props();
</script>

<div class="admin auth">
	<main class="card panel">
		<p class="brand">Folio</p>
		<h1>{title}</h1>
		{#if intro}<p class="hint intro">{intro}</p>{/if}
		{@render children()}
	</main>
</div>

<style>
	.auth {
		display: grid;
		place-items: center;
		padding: 24px 16px;
	}

	.panel {
		width: min(420px, 100%);
		padding: 36px 32px;
	}

	.brand {
		margin: 0 0 20px;
		font-family: 'Jost Variable', var(--sans);
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--muted);
	}

	h1 {
		font-size: 1.5rem;
	}

	.intro {
		margin-top: 8px;
		font-size: 0.875rem;
	}

	@media (max-width: 480px) {
		.panel {
			padding: 28px 20px;
		}
	}
</style>
