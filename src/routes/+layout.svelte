<script lang="ts">
	import '$lib/styles/base.css';
	import Toasts from '$lib/components/Toasts.svelte';

	let { children } = $props();
</script>

{@render children()}
<Toasts />
