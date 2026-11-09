export interface Toast {
	id: number;
	message: string;
	tone: 'info' | 'error';
}

let nextId = 1;

export const toasts = $state<Toast[]>([]);

export function toast(message: string, tone: Toast['tone'] = 'info', duration = 4000): void {
	const id = nextId++;
	toasts.push({ id, message, tone });
	setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: number): void {
	const index = toasts.findIndex((t) => t.id === id);
	if (index >= 0) toasts.splice(index, 1);
}
