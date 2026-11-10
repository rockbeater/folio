<script lang="ts">
	import { onMount } from 'svelte';
	import Download from '@lucide/svelte/icons/download';
	import X from '@lucide/svelte/icons/x';
	import { useI18n } from '$lib/i18n';

	/** Shown when a visitor tries to save a photo the hard way (long press, right-click, PrintScreen). */
	let { ondownload, onclose }: { ondownload: () => void; onclose: () => void } = $props();
	const { t } = useI18n();
	let pos = $state<{ top: number; right: number; arrow: number } | null>(null);

	onMount(() => {
		// Point at the download button: the one in the lightbox if it is open, else the one in the header.
		const target = document.querySelector('[data-save-target="lightbox"]') ?? document.querySelector('[data-save-target="header"]');
		const rect = target?.getBoundingClientRect();
		if (rect && rect.width > 0) {
			const right = Math.max(12, window.innerWidth - rect.right - 8);
			pos = { top: rect.bottom + 12, right, arrow: window.innerWidth - right - (rect.left + rect.width / 2) - 8 };
		}
		const timer = setTimeout(onclose, 9000);
		return () => clearTimeout(timer);
	});
</script>

<div
	class="hint"
	class:anchored={pos}
	role="status"
	style:top={pos ? `${pos.top}px` : undefined}
	style:right={pos ? `${pos.right}px` : undefined}
	style:--arrow={pos ? `${pos.arrow}px` : undefined}
>
	<button class="close" type="button" onclick={onclose} aria-label={t('common.close')}><X size={16} /></button>
	<strong>{t('client.hint.title')}</strong>
	<p>{t('client.hint.text')}</p>
	<button class="c-btn solid small" type="button" onclick={ondownload}><Download size={16} />{t('client.hint.download')}</button>
</div>

<style>
	.hint {
		position: fixed;
		z-index: 1000;
		left: 50%;
		bottom: var(--space-6);
		width: min(320px, calc(100vw - 24px));
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-4);
		transform: translateX(-50%);
		background: var(--color-bg);
		color: var(--color-text);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
		animation: pop var(--dur-ui) var(--ease-out);
	}

	.hint.anchored {
		left: auto;
		bottom: auto;
		transform: none;
	}

	/* Arrow pointing up at the download button. */
	.hint.anchored::before {
		content: '';
		position: absolute;
		top: -8px;
		right: var(--arrow);
		width: 16px;
		height: 16px;
		background: inherit;
		transform: rotate(45deg);
	}

	p {
		margin: 0 0 var(--space-2);
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		line-height: 1.45;
	}

	.close {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		padding: 4px;
		border: 0;
		background: none;
		color: var(--color-text-muted);
	}

	@keyframes pop {
		from {
			opacity: 0;
			translate: 0 6px;
		}
	}
</style>
