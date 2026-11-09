import { getContext, setContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

export type DownloadScope = 'all' | 'section' | 'favorites' | 'photo';

export interface DownloadRequest {
	scope: DownloadScope;
	sectionId?: string;
	photoId?: string;
}

/** Client-side state shared by all pages of one gallery (favorites, dialogs). */
export class GalleryState {
	slug: string;
	email = $state<string | null>(null);
	favorites = new SvelteSet<string>();
	emailPrompt = $state<{ resolve: (ok: boolean) => void } | null>(null);
	download = $state<DownloadRequest | null>(null);

	constructor(slug: string, email: string | null, favorites: string[]) {
		this.slug = slug;
		this.email = email;
		for (const id of favorites) this.favorites.add(id);
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
		const res = await fetch(`/g/${this.slug}/api/visitor`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email })
		});
		if (!res.ok) return false;
		const data = (await res.json()) as { email: string; favorites: string[] };
		this.email = data.email;
		for (const id of data.favorites) this.favorites.add(id);
		this.emailPrompt?.resolve(true);
		this.emailPrompt = null;
		return true;
	}

	async toggleFavorite(photoId: string): Promise<boolean> {
		if (!(await this.ensureVisitor())) return false;
		const favorite = !this.favorites.has(photoId);
		if (favorite) this.favorites.add(photoId);
		else this.favorites.delete(photoId);
		const res = await fetch(`/g/${this.slug}/api/favorites`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ photoId, favorite })
		}).catch(() => null);
		if (!res?.ok) {
			if (favorite) this.favorites.delete(photoId);
			else this.favorites.add(photoId);
			return false;
		}
		return true;
	}
}

const KEY = Symbol('gallery-state');

export function setGalleryState(state: GalleryState): GalleryState {
	return setContext(KEY, state);
}

export function getGalleryState(): GalleryState {
	return getContext<GalleryState>(KEY);
}
