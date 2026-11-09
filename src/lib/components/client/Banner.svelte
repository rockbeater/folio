<script lang="ts">
	import { onMount } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';

	let { galleryId, text, code }: { galleryId: string; text: string; code: string } = $props();
	const { t } = useI18n();

	// The visitor's choice to close the banner is remembered per gallery and text.
	// svelte-ignore state_referenced_locally
	const storageKey = `folio-banner:${galleryId}:${text}`;
	let visible = $state(true);

	onMount(() => {
		try {
			if (localStorage.getItem(storageKey)) visible = false;
		} catch {
			// storage unavailable: keep showing the banner
		}
	});

	function close() {
		visible = false;
		try {
			localStorage.setItem(storageKey, '1');
		} catch {
			// ignore
		}
	}

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(code);
			toast(t('client.banner.copied'));
		} catch {
			// clipboard not available
		}
	}
</script>

{#if visible}
	<aside class="banner" aria-label={text}>
		<p class="text">{text}</p>
		{#if code}
			<span class="divider" aria-hidden="true"></span>
			<button type="button" class="code label" onclick={copyCode}>{t('client.banner.code', { code })}</button>
		{/if}
		<button type="button" class="close" onclick={close} aria-label={t('common.close')}><X size={18} strokeWidth={1.5} /></button>
	</aside>
{/if}

<style>
	.banner {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-2) var(--space-5);
		padding: var(--space-3) calc(var(--space-7) + var(--space-2));
		background: var(--color-surface);
		color: var(--color-text);
		text-align: center;
	}

	.text {
		margin: 0;
		font-size: 0.9375rem;
	}

	.divider {
		width: 1px;
		height: 20px;
		background: var(--color-border);
	}

	.code {
		border: 0;
		background: none;
		padding: var(--space-1) 0;
		text-decoration: underline;
		text-decoration-color: transparent;
		text-underline-offset: 4px;
	}

	.code:hover {
		text-decoration-color: currentColor;
	}

	.close {
		position: absolute;
		top: 50%;
		right: var(--space-2);
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin-top: -22px;
		border: 0;
		background: none;
	}

	@media (max-width: 599px) {
		.divider {
			display: none;
		}

		.banner {
			flex-direction: column;
			gap: 2px;
		}
	}
</style>
