import { getContext, setContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { MessageKey } from '$lib/i18n';
import { toast } from '$lib/toast.svelte';
import type { ListView } from '$lib/types';

export type DownloadScope = 'all' | 'section' | 'favorites' | 'photo';

export interface DownloadRequest {
	scope: DownloadScope;
	sectionId?: string;
	photoId?: string;
}

/** What the server returns about the visitor after each favorite or list change. */
export interface VisitorData {
	email: string | null;
	favorites: string[];
	lists: ListView[];
	activeListId: string | null;
}

interface Init {
	slug: string;
	visitor: VisitorData;
	canMarkPrivate?: boolean;
	/** Token of the shared list this page shows (share pages only). */
	share?: string | null;
	t: (key: MessageKey) => string;
}

/** Client-side state shared by all pages of one gallery (favorites, lists, dialogs, selection). */
export class GalleryState {
	slug: string;
	share: string | null;
	canMarkPrivate = $state(false);
	email = $state<string | null>(null);
	favorites = new SvelteSet<string>();
	lists = $state<ListView[]>([]);
	activeListId = $state<string | null>(null);
	emailPrompt = $state<{ resolve: (ok: boolean) => void } | null>(null);
	download = $state<DownloadRequest | null>(null);
	/** Incremented when the visitor starts the slideshow from the header. */
	slideshowRequests = $state(0);
	/** Private marks changed on this page, on top of what the server sent. */
	privateMarks = new SvelteMap<string, boolean>();
	/** Multi-select (the client marks several photos private at once). */
	selecting = $state(false);
	selection = new SvelteSet<string>();
	private t: Init['t'];

	constructor(init: Init) {
		this.slug = init.slug;
		this.share = init.share ?? null;
		this.canMarkPrivate = init.canMarkPrivate ?? false;
		this.t = init.t;
		this.apply(init.visitor);
	}

	get activeList(): ListView | null {
		return this.lists.find((l) => l.id === this.activeListId) ?? null;
	}

	apply(data: VisitorData): void {
		this.email = data.email;
		this.favorites.clear();
		for (const id of data.favorites) this.favorites.add(id);
		this.lists = data.lists;
		this.activeListId = data.activeListId;
	}

	private async post<T = VisitorData>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
		const res = await fetch(`/g/${this.slug}/api/${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}).catch(() => null);
		if (!res) return { ok: false, status: 0, data: null };
		const data = res.ok ? ((await res.json()) as T) : null;
		return { ok: res.ok, status: res.status, data };
	}

	/** Ask for an email once, so favorites can be saved for this visitor. */
	ensureVisitor(): Promise<boolean> {
		if (this.email) return Promise.resolve(true);
		return new Promise((resolve) => {
			this.emailPrompt = { resolve };
		});
	}

	cancelEmailPrompt(): void {
		this.emailPrompt?.resolve(false);
		this.emailPrompt = null;
	}

	async submitEmail(email: string): Promise<boolean> {
		const { ok, data } = await this.post('visitor', { email, share: this.share });
		if (!ok || !data) return false;
		this.apply(data);
		this.emailPrompt?.resolve(true);
		this.emailPrompt = null;
		return true;
	}

	async toggleFavorite(photoId: string): Promise<boolean> {
		if (!(await this.ensureVisitor())) return false;
		const favorite = !this.favorites.has(photoId);
		if (favorite) this.favorites.add(photoId);
		else this.favorites.delete(photoId);
		const { ok, status, data } = await this.post('favorites', { photoId, favorite });
		if (ok && data) {
			this.apply(data);
			return true;
		}
		if (favorite) this.favorites.delete(photoId);
		else this.favorites.add(photoId);
		toast(this.t(status === 409 ? 'client.lists.limitReached' : 'common.error'), status === 409 ? 'info' : 'error');
		return false;
	}

	/** Run a list action (create, rename, activate, share, …) and take over the new state. */
	async listAction(body: Record<string, unknown>): Promise<(VisitorData & { omitted?: number }) | null> {
		const { ok, data } = await this.post<VisitorData & { omitted?: number }>('lists', body);
		if (!ok || !data) {
			toast(this.t('common.error'), 'error');
			return null;
		}
		this.apply(data);
		return data;
	}

	isPrivate(photo: { id: string; private: boolean }): boolean {
		return this.privateMarks.get(photo.id) ?? photo.private;
	}

	async setPrivate(photoIds: string[], value: boolean): Promise<boolean> {
		const { ok } = await this.post('private', { photoIds, private: value });
		if (!ok) {
			toast(this.t('common.error'), 'error');
			return false;
		}
		for (const id of photoIds) this.privateMarks.set(id, value);
		toast(this.t(value ? 'client.private.marked' : 'client.private.unmarked'));
		return true;
	}

	stopSelecting(): void {
		this.selecting = false;
		this.selection.clear();
	}
}

const KEY = Symbol('gallery-state');

export function setGalleryState(state: GalleryState): GalleryState {
	return setContext(KEY, state);
}

export function getGalleryState(): GalleryState {
	return getContext<GalleryState>(KEY);
}
