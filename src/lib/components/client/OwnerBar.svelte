<script lang="ts">
	import { useI18n } from '$lib/i18n';
	import type { GalleryStatus } from '$lib/types';

	let { galleryId, status }: { galleryId: string; status: GalleryStatus } = $props();
	const { t } = useI18n();
</script>

<div class="owner-bar" role="note">
	<span>{status === 'published' ? t('client.ownerBar') : t('client.draftNotice')}</span>
	<a href="/admin/galleries/{galleryId}" data-sveltekit-reload>{t('client.ownerEdit')}</a>
</div>

<style>
	.owner-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-1) var(--space-4);
		padding: var(--space-2) var(--space-4);
		background: #1e1e1e;
		color: #ffffff;
		font-family: var(--sans);
		font-size: 0.8125rem;
		text-align: center;
	}

	a {
		color: inherit;
		font-weight: 600;
	}
</style>
