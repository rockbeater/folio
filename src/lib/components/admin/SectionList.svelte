<script lang="ts">
	import { goto } from '$app/navigation';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import { callAction } from '$lib/admin-actions';
	import { useI18n } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import type { AdminSection } from './editor-types';

	let { sections, activeId }: { sections: AdminSection[]; activeId: string | null } = $props();
	const { t } = useI18n();

	let adding = $state(false);
	let newName = $state('');
	let renaming = $state<string | null>(null);
	let renameValue = $state('');
	let order = $state<string[]>([]);
	let dragId = $state<string | null>(null);

	$effect(() => {
		order = sections.map((s) => s.id);
	});

	const ordered = $derived(order.map((id) => sections.find((s) => s.id === id)).filter((s): s is AdminSection => Boolean(s)));

	function select(id: string) {
		goto(`?tab=photos&section=${id}`, { noScroll: true, keepFocus: true, replaceState: true });
	}

	async function add(event: SubmitEvent) {
		event.preventDefault();
		const name = newName.trim();
		if (!name) return;
		const result = await callAction('addSection', { name });
		if (result.type === 'success') {
			adding = false;
			newName = '';
			const id = (result.data as { sectionId?: string } | undefined)?.sectionId;
			if (id) select(id);
		} else toast(t('common.error'), 'error');
	}

	async function rename(event: SubmitEvent, id: string) {
		event.preventDefault();
		const result = await callAction('renameSection', { id, name: renameValue.trim() });
		if (result.type === 'success') renaming = null;
		else toast(t('common.error'), 'error');
	}

	async function remove(section: AdminSection) {
		if (!confirm(t('admin.editor.deleteSectionConfirm', { name: section.name }))) return;
		await callAction('deleteSection', { id: section.id });
		if (activeId === section.id) goto('?tab=photos', { noScroll: true, replaceState: true });
	}

	function onDragOver(event: DragEvent, overId: string) {
		if (!dragId || dragId === overId) return;
		event.preventDefault();
		const from = order.indexOf(dragId);
		const to = order.indexOf(overId);
		const next = [...order];
		next.splice(from, 1);
		next.splice(to, 0, dragId);
		order = next;
	}

	async function onDrop() {
		if (!dragId) return;
		dragId = null;
		await callAction('reorderSections', { ids: order });
	}
</script>

<div class="sections">
	<div class="head">
		<span class="field-label">{t('admin.editor.sections')}</span>
		<button class="btn ghost small" type="button" onclick={() => (adding = true)}>
			<Plus size={14} />{t('admin.editor.addSection')}
		</button>
	</div>

	{#if sections.length === 0 && !adding}
		<p class="hint">{t('admin.editor.noSections')}</p>
	{/if}

	<ul>
		{#each ordered as section (section.id)}
			<li
				class:active={section.id === activeId}
				class:dragging={dragId === section.id}
				draggable={renaming !== section.id}
				ondragstart={(e) => {
					dragId = section.id;
					e.dataTransfer?.setData('text/plain', section.id);
				}}
				ondragover={(e) => onDragOver(e, section.id)}
				ondrop={onDrop}
				ondragend={onDrop}
			>
				{#if renaming === section.id}
					<form class="rename" onsubmit={(e) => rename(e, section.id)}>
						<!-- svelte-ignore a11y_autofocus -->
						<input type="text" bind:value={renameValue} autofocus aria-label={t('admin.editor.sectionName')} />
						<button class="btn small primary" type="submit">{t('common.save')}</button>
					</form>
				{:else}
					<span class="grip" aria-hidden="true"><GripVertical size={14} /></span>
					<button class="name" type="button" onclick={() => select(section.id)}>
						<span>{section.name}</span>
						<span class="count tabular">{section.photos.length}</span>
					</button>
					<span class="tools">
						<button
							class="icon-btn"
							type="button"
							aria-label={t('common.rename')}
							onclick={() => {
								renaming = section.id;
								renameValue = section.name;
							}}><Pencil size={14} /></button
						>
						<button class="icon-btn" type="button" aria-label={t('admin.editor.deleteSection')} onclick={() => remove(section)}
							><Trash size={14} /></button
						>
					</span>
				{/if}
			</li>
		{/each}
	</ul>

	{#if adding}
		<form class="rename" onsubmit={add}>
			<!-- svelte-ignore a11y_autofocus -->
			<input type="text" bind:value={newName} placeholder={t('admin.editor.sectionName')} autofocus />
			<button class="btn small primary" type="submit">{t('common.save')}</button>
			<button class="btn small ghost" type="button" onclick={() => (adding = false)}>{t('common.cancel')}</button>
		</form>
	{/if}
</div>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	ul {
		list-style: none;
		margin: 0 -8px;
		padding: 0;
	}

	li {
		display: flex;
		align-items: center;
		gap: 2px;
		min-height: 40px;
		padding: 0 4px 0 6px;
		border-radius: var(--radius);
	}

	li:hover {
		background: var(--admin-bg);
	}

	li.active {
		background: var(--accent-soft);
	}

	li.dragging {
		opacity: 0.5;
	}

	.grip {
		color: var(--muted);
		cursor: grab;
		display: grid;
	}

	.name {
		flex: 1;
		min-width: 0;
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 4px;
		border: 0;
		background: none;
		text-align: left;
		font-weight: 500;
	}

	.name span:first-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.count {
		color: var(--muted);
		font-size: 0.8125rem;
	}

	.tools {
		display: none;
	}

	li:hover .tools,
	li:focus-within .tools {
		display: flex;
	}

	.tools .icon-btn {
		width: 28px;
		height: 28px;
	}

	.rename {
		display: flex;
		gap: 6px;
		flex: 1;
		flex-wrap: wrap;
		padding: 4px 0;
	}

	.rename input {
		flex: 1 1 120px;
		min-height: 32px !important;
		padding: 4px 8px !important;
	}
</style>
