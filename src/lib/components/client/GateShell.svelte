<script lang="ts" module>
	import type { PhotoView } from '$lib/types';

	export interface GateCover {
		photo: PhotoView | null;
		placeholder: string | null;
		color: string | null;
		focalX: number;
		focalY: number;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { displaySrcset, displayUrl } from '$lib/types';

	interface Props {
		title: string;
		subtitle?: string | null;
		cover?: GateCover | null;
		children: Snippet;
	}

	let { title, subtitle = null, cover = null, children }: Props = $props();
</script>

<!-- Full-screen entry screen over the cover photo: choose guest/client, passwords, registration. -->
<main class="gate" style:background-color={cover?.color ?? '#1e1e1e'}>
	{#if cover?.photo}
		<img
			class="bg"
			src={displayUrl(cover.photo, 1600)}
			srcset={displaySrcset(cover.photo)}
			sizes="100vw"
			alt=""
			style:object-position="{cover.focalX * 100}% {cover.focalY * 100}%"
		/>
	{:else if cover?.placeholder}
		<img class="bg blur" src={cover.placeholder} alt="" />
	{/if}
	<div class="shade" aria-hidden="true"></div>
	<div class="content">
		<h1>{title}</h1>
		{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
		<div class="body">{@render children()}</div>
	</div>
</main>

<style>
	.gate {
		position: relative;
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: var(--space-6) var(--space-4);
		overflow: hidden;
		color: #fff;
	}

	.bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.bg.blur {
		filter: blur(40px);
		transform: scale(1.2);
	}

	.shade {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
	}

	.content {
		position: relative;
		width: min(560px, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(1.25rem, 2.6vw, 1.75rem);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.subtitle {
		margin: var(--space-3) 0 0;
		font-family: var(--font-label);
		font-size: 0.75rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		opacity: 0.75;
	}

	.body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		width: 100%;
		margin-top: var(--space-7);
	}

	/* Shared by the entry screens that render inside the shell. */
	.body :global(.gate-text) {
		margin: 0 0 var(--space-2);
		color: rgba(255, 255, 255, 0.78);
		font-size: 1.0625rem;
		line-height: 1.5;
	}

	.body :global(.gate-text strong) {
		color: #fff;
	}

	.body :global(.gate-text a),
	.body :global(.gate-link) {
		padding: 0;
		border: 0;
		background: none;
		color: rgba(255, 255, 255, 0.78);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.body :global(.gate-btn) {
		width: min(350px, 100%);
		min-height: 64px;
		padding: 0 var(--space-5);
		border: 1px solid rgba(255, 255, 255, 0.9);
		background: transparent;
		color: #fff;
		font-family: var(--font-label);
		font-size: 0.8125rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		transition: background-color var(--dur-ui) var(--ease-out);
	}

	.body :global(.gate-btn:hover),
	.body :global(.gate-btn:focus-visible) {
		background: rgba(255, 255, 255, 0.14);
	}

	.body :global(.gate-btn.small) {
		width: auto;
		min-width: 250px;
		margin-top: var(--space-4);
	}

	.body :global(.gate-btn:disabled) {
		opacity: 0.5;
	}

	.body :global(.gate-input) {
		width: 100%;
		height: 64px;
		padding: 0 var(--space-4);
		border: 1px solid rgba(255, 255, 255, 0.6);
		border-radius: 0;
		background: #fff;
		color: #1e1e1e;
		font-size: 1.125rem;
	}

	.body :global(.gate-input:focus) {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}

	.body :global(.gate-error) {
		margin: 0;
		color: #ffb4a8;
		font-size: 0.9375rem;
	}

	.body :global(form) {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		width: 100%;
	}
</style>
