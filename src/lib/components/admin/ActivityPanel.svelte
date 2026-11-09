<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import FileDown from '@lucide/svelte/icons/file-down';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';

	interface Activity {
		visits: number;
		downloadCount: number;
		registrations: number;
		downloads: { id: string; email: string | null; scope: string; size: string; count: number; target: string; createdAt: number }[];
		visitors: { id: string; email: string; createdAt: number; favorites: number; downloads: number }[];
		favorites: { email: string; files: string[] }[];
	}

	let { activity, galleryName }: { activity: Activity; galleryName: string } = $props();
	const { t, plural, lang } = useI18n();
	const dateTime = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });

	async function copyFiles(files: string[]) {
		await navigator.clipboard.writeText(files.join(', '));
		toast(t('admin.settings.filenamesCopied'));
	}

	function exportCsv(email: string, files: string[]) {
		const rows = [['email', 'filename'], ...files.map((f) => [email, f])];
		const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `${galleryName}-favorites-${email}.csv`.replace(/[^\w.@-]+/g, '-');
		a.click();
		URL.revokeObjectURL(url);
	}

	function scopeText(d: Activity['downloads'][number]): string {
		const what = t(`admin.activity.scope.${d.scope}` as MessageKey);
		return d.target ? `${what}: ${d.target}` : what;
	}
</script>

<div class="activity stack">
	<div class="stats">
		<div class="card stat"><span class="value tabular">{activity.visits}</span><span class="hint">{t('admin.activity.visits')}</span></div>
		<div class="card stat"><span class="value tabular">{activity.downloadCount}</span><span class="hint">{t('admin.activity.downloads')}</span></div>
		<div class="card stat"><span class="value tabular">{activity.visitors.length}</span><span class="hint">{t('admin.activity.visitors')}</span></div>
	</div>

	<section class="card block">
		<h3>{t('admin.activity.favorites')}</h3>
		{#if activity.favorites.length === 0}
			<p class="hint">{t('admin.settings.favoritesNone')}</p>
		{:else}
			<ul class="list">
				{#each activity.favorites as fav (fav.email)}
					<li>
						<div class="who">
							<strong>{fav.email}</strong>
							<span class="hint">{plural('common.photos', fav.files.length)}</span>
						</div>
						<div class="row">
							<button class="btn small" type="button" onclick={() => copyFiles(fav.files)}><Copy size={14} />{t('admin.settings.copyFilenames')}</button>
							<button class="btn small ghost" type="button" onclick={() => exportCsv(fav.email, fav.files)}><FileDown size={14} />CSV</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="card block">
		<h3>{t('admin.activity.downloadLog')}</h3>
		{#if activity.downloads.length === 0}
			<p class="hint">{t('admin.activity.noDownloads')}</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>{t('admin.activity.who')}</th>
							<th>{t('admin.activity.what')}</th>
							<th>{t('admin.activity.size')}</th>
							<th>{t('admin.activity.when')}</th>
						</tr>
					</thead>
					<tbody>
						{#each activity.downloads as d (d.id)}
							<tr>
								<td>{d.email ?? t('admin.activity.anonymous')}</td>
								<td>{scopeText(d)} <span class="hint">({plural('common.photos', d.count)})</span></td>
								<td>{d.size === 'web' ? t('client.dl.web') : t('client.dl.highRes')}</td>
								<td class="hint">{dateTime.format(d.createdAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section class="card block">
		<h3>{t('admin.activity.visitorList')}</h3>
		<p class="hint">{t('admin.activity.visitorHint')}</p>
		{#if activity.visitors.length === 0}
			<p class="hint">{t('admin.activity.noVisitors')}</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>{t('common.email')}</th>
							<th>{t('admin.activity.firstSeen')}</th>
							<th>{t('admin.activity.favorites')}</th>
							<th>{t('admin.activity.downloads')}</th>
						</tr>
					</thead>
					<tbody>
						{#each activity.visitors as v (v.id)}
							<tr>
								<td>{v.email}</td>
								<td class="hint">{dateTime.format(v.createdAt)}</td>
								<td class="tabular">{v.favorites}</td>
								<td class="tabular">{v.downloads}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.activity {
		max-width: 900px;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 18px;
	}

	.value {
		font-size: 1.75rem;
		font-weight: 600;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px 22px;
	}

	h3 {
		font-size: 1rem;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 10px 12px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	.who {
		display: flex;
		flex-direction: column;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	th {
		text-align: left;
		font-weight: 600;
		color: var(--muted);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 6px 10px 8px 0;
		border-bottom: 1px solid var(--line);
	}

	td {
		padding: 9px 10px 9px 0;
		border-bottom: 1px solid var(--line);
		vertical-align: top;
	}

	tr:last-child td {
		border-bottom: 0;
	}

	@media (max-width: 640px) {
		.stats {
			grid-template-columns: 1fr 1fr 1fr;
			gap: 8px;
		}

		.value {
			font-size: 1.25rem;
		}
	}
</style>
