<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import FileDown from '@lucide/svelte/icons/file-down';
	import { callAction } from '$lib/admin-actions';
	import { useI18n, type MessageKey } from '$lib/i18n';
	import ShareLinkDialog from './ShareLinkDialog.svelte';
	import { toast } from '$lib/toast.svelte';

	interface Activity {
		visits: number;
		downloadCount: number;
		registrations: number;
		downloads: { id: string; email: string | null; scope: string; size: string; count: number; target: string; createdAt: number }[];
		visitors: { id: string; email: string; createdAt: number; favorites: number; downloads: number }[];
		favoriteLists: {
			id: string;
			email: string;
			name: string;
			submittedAt: number | null;
			items: { filename: string; note: string | null }[];
			share: { token: string; private: boolean; views: number; downloads: number } | null;
		}[];
		privatePhotos: { id: string; filename: string; section: string }[];
		shareLinks: {
			id: string;
			token: string;
			name: string;
			count: number;
			download: { enabled: boolean; highRes: boolean; web: boolean };
			expiresOn: string | null;
			password: string | null;
			active: boolean;
			views: number;
			downloads: number;
			createdAt: number;
		}[];
	}

	let { activity, galleryName, baseUrl }: { activity: Activity; galleryName: string; baseUrl: string } = $props();
	let editing = $state<Activity['shareLinks'][number] | null>(null);
	const today = new Date().toLocaleDateString('sv-SE');

	async function copyLink(path: string) {
		await navigator.clipboard.writeText(`${baseUrl}${path}`);
		toast(t('admin.editor.linkCopied'));
	}

	async function run(name: string, data: Record<string, unknown>, confirmText?: string) {
		if (confirmText && !confirm(confirmText)) return;
		const result = await callAction(name, data as Record<string, string>);
		if (result.type !== 'success') toast(t('common.error'), 'error');
	}
	const { t, plural, lang } = useI18n();
	const dateTime = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });

	async function copyFiles(files: string[]) {
		await navigator.clipboard.writeText(files.join(', '));
		toast(t('admin.settings.filenamesCopied'));
	}

	function exportCsv(email: string, list: string, items: { filename: string; note: string | null }[]) {
		const rows = [['email', 'list', 'filename', 'note'], ...items.map((i) => [email, list, i.filename, i.note ?? ''])];
		const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `${galleryName}-${list || 'favorites'}-${email}.csv`.replace(/[^\w.@-]+/g, '-');
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
		{#if activity.favoriteLists.length === 0}
			<p class="hint">{t('admin.settings.favoritesNone')}</p>
		{:else}
			<ul class="list">
				{#each activity.favoriteLists as list (list.id)}
					{@const listName = list.name || t('client.lists.default')}
					<li class="column">
						<div class="line">
							<div class="who">
								<strong>{list.email}</strong>
								<span class="hint">
									{listName} · {plural('common.photos', list.items.length)}
									{#if list.submittedAt} · <span class="badge on">{t('admin.lists.submittedOn', { date: dateTime.format(list.submittedAt) })}</span>{/if}
								</span>
							</div>
							<div class="row">
								<button class="btn small" type="button" disabled={list.items.length === 0} onclick={() => copyFiles(list.items.map((i) => i.filename))}
									><Copy size={14} />{t('admin.settings.copyFilenames')}</button
								>
								<button class="btn small ghost" type="button" disabled={list.items.length === 0} onclick={() => exportCsv(list.email, listName, list.items)}
									><FileDown size={14} />CSV</button
								>
							</div>
						</div>
						{#if list.items.some((i) => i.note)}
							<details>
								<summary class="hint">{t('admin.lists.notes', { count: list.items.filter((i) => i.note).length })}</summary>
								<ul class="notes">
									{#each list.items.filter((i) => i.note) as item (item.filename)}
										<li><strong>{item.filename}</strong> {item.note}</li>
									{/each}
								</ul>
							</details>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="card block">
		<h3>{t('admin.links.title')}</h3>
		<p class="hint">{t('admin.links.hint')}</p>
		{#if activity.shareLinks.length === 0 && !activity.favoriteLists.some((l) => l.share)}
			<p class="hint">{t('admin.links.none')}</p>
		{:else}
			<ul class="list">
				{#each activity.shareLinks as link (link.id)}
					{@const expired = Boolean(link.expiresOn && link.expiresOn < today)}
					<li>
						<div class="who">
							<strong>{link.name}</strong>
							<span class="hint">
								{plural('common.photos', link.count)} · {t('admin.links.stats', { views: link.views, downloads: link.downloads })}
								{#if !link.active}· <span class="badge">{t('admin.links.inactive')}</span>{:else if expired}· <span class="badge">{t('admin.settings.expired')}</span>{/if}
								{#if link.password}· {t('common.password')}{/if}
							</span>
						</div>
						<div class="row">
							<button class="btn small" type="button" onclick={() => copyLink(`/q/${link.token}`)}><Copy size={14} />{t('admin.editor.copyLink')}</button>
							<button class="btn small ghost" type="button" onclick={() => (editing = link)}>{t('common.edit')}</button>
							<button class="btn small ghost" type="button" onclick={() => run('toggleLink', { id: link.id, active: String(!link.active) })}>
								{link.active ? t('admin.links.deactivate') : t('admin.links.activate')}
							</button>
							<button class="btn small ghost" type="button" onclick={() => run('toggleLink', { id: link.id, delete: '1' }, t('admin.links.deleteConfirm', { name: link.name }))}>
								{t('common.delete')}
							</button>
						</div>
					</li>
				{/each}
				{#each activity.favoriteLists.filter((l) => l.share) as list (list.id)}
					<li>
						<div class="who">
							<strong>{list.name || t('client.lists.default')} · {list.email}</strong>
							<span class="hint">
								{list.share!.private ? t('admin.lists.privateShare') : t('admin.lists.openShare')} ·
								{t('admin.links.stats', { views: list.share!.views, downloads: list.share!.downloads })}
							</span>
						</div>
						<div class="row">
							<button class="btn small" type="button" onclick={() => copyLink(`/l/${list.share!.token}`)}><Copy size={14} />{t('admin.editor.copyLink')}</button>
							<button class="btn small ghost" type="button" onclick={() => run('unshareList', { id: list.id }, t('admin.lists.unshareConfirm'))}>
								{t('admin.links.deactivate')}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if activity.privatePhotos.length > 0}
		<section class="card block">
			<div class="line">
				<h3>{t('admin.private.title')}</h3>
				<button class="btn small ghost" type="button" onclick={() => run('unmarkPrivate', { ids: JSON.stringify(activity.privatePhotos.map((p) => p.id)) }, t('admin.private.unmarkAllConfirm'))}>
					{t('admin.private.unmarkAll')}
				</button>
			</div>
			<p class="hint">{t('admin.private.hint')}</p>
			<ul class="list">
				{#each activity.privatePhotos as photo (photo.id)}
					<li>
						<div class="who"><strong>{photo.filename}</strong><span class="hint">{photo.section}</span></div>
						<button class="btn small ghost" type="button" onclick={() => run('unmarkPrivate', { ids: JSON.stringify([photo.id]) })}>{t('admin.private.unmark')}</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

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

{#if editing}
	<ShareLinkDialog link={editing} {baseUrl} onclose={() => (editing = null)} />
{/if}

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

	.list li.column {
		flex-direction: column;
		align-items: stretch;
	}

	.line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.notes {
		margin: 8px 0 0;
		padding-left: 18px;
		font-size: 0.875rem;
	}

	summary {
		cursor: pointer;
	}
</style>
