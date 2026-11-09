<script lang="ts">
	import '$lib/styles/base.css';
	import Toasts from '$lib/components/Toasts.svelte';

	let { data, children } = $props();
</script>

<svelte:head>
	{#if data.favicon}<link rel="icon" href={data.favicon} />{/if}
</svelte:head>

{@render children()}
<Toasts />
