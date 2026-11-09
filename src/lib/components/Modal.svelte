<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { useI18n } from '$lib/i18n';

	interface Props {
		title: string;
		onclose: () => void;
		children: Snippet;
		wide?: boolean;
	}

	let { title, onclose, children, wide = false }: Props = $props();
	const { t } = useI18n();
	let dialog: HTMLDialogElement;

	onMount(() => {
		dialog.showModal();
		return () => {
			if (dialog.open) dialog.close();
		};
	});

	function onBackdrop(event: MouseEvent) {
		if (event.target === dialog) onclose();
	}
</script>

<dialog
	bind:this={dialog}
	class="modal"
	class:wide
	aria-label={title}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
	onclick={onBackdrop}
>
	<div class="panel">
		<header>
			<h2>{title}</h2>
			<button type="button" class="close" onclick={onclose} aria-label={t('common.close')}>
				<X size={20} strokeWidth={1.5} />
			</button>
		</header>
		<div class="body">
			{@render children()}
		</div>
	</div>
</dialog>

<style>
	.modal {
		border: 0;
		padding: 0;
		margin: auto;
		width: min(480px, calc(100vw - 32px));
		max-height: calc(100dvh - 48px);
		background: var(--color-bg);
		color: var(--color-text);
		overflow: visible;
	}

	.modal.wide {
		width: min(720px, calc(100vw - 32px));
	}

	.modal::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.modal[open] {
		animation: modal-in var(--dur-ui) var(--ease-out);
	}

	.panel {
		display: flex;
		flex-direction: column;
		max-height: calc(100dvh - 48px);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-5) var(--space-3);
	}

	h2 {
		margin: 0;
		font-family: var(--font-label);
		font-size: 0.8125rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.close {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin: -12px -12px -12px 0;
		border: 0;
		background: none;
	}

	.body {
		padding: var(--space-2) var(--space-5) var(--space-5);
		overflow: auto;
	}

	@media (max-width: 599px) {
		.modal,
		.modal.wide {
			width: 100vw;
			max-width: 100vw;
			margin: auto 0 0;
			max-height: 92dvh;
		}

		.panel {
			max-height: 92dvh;
			padding-bottom: env(safe-area-inset-bottom);
		}

		.modal[open] {
			animation: sheet-in var(--dur-big) var(--ease-out);
		}
	}

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	@keyframes sheet-in {
		from {
			transform: translateY(100%);
		}
	}
</style>
