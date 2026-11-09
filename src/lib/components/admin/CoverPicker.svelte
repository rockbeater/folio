<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { callAction } from '$lib/admin-actions';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { displayUrl } from '$lib/types';
	import type { AdminSection } from './editor-types';

	let { sections, coverId, onclose }: { sections: AdminSection[]; coverId: string | null; onclose: () => void } = $props();
	const { t } = useI18n();
	let busy = $state(false);

	async function choose(id: string) {
		busy = true;
		const result = await callAction('cover', { photoId: id });
		busy = false;
		if (result.type === 'success') {
			toast(t('admin.cover.changed'));
			onclose();
		} else toast(t('common.error'), 'error');
	}
</script>

<Modal title={t('admin.cover.choose')} {onclose} wide>
	<p class="hint intro">{t('admin.cover.hint')}</p>
	{#each sections as section (section.id)}
		{@const ready = section.photos.filter((p) => p.status === 'ready')}
		{#if ready.length > 0}
			<h3 class="field-label">{section.name}</h3>
			<ul class="grid">
				{#each ready as photo (photo.id)}
					<li>
						<button
							type="button"
							class:current={photo.id === coverId}
							disabled={busy}
							onclick={() => choose(photo.id)}
							aria-label={photo.filename}
							title={photo.filename}
						>
							<img src={displayUrl(photo, 480)} alt="" loading="lazy" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
</Modal>

<style>
	.intro {
		margin-bottom: 16px;
	}

	h3 {
		margin: 16px 0 8px;
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 8px;
	}

	button {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 6px;
		background: var(--admin-bg);
		overflow: hidden;
	}

	button:hover {
		border-color: var(--line);
	}

	button.current {
		border-color: var(--accent);
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
