/**
 * Attachment: calls `onpress` on a long press (touch) or a right-click, instead of the
 * browser's own "save image" menu. Use with {@attach longPress(() => …)}.
 */
export function longPress(onpress: () => void) {
	return (node: HTMLElement) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		let start = { x: 0, y: 0 };
		let last = 0;
		const fire = () => {
			// Android sends both the long touch and a contextmenu event: react once.
			if (Date.now() - last < 1000) return;
			last = Date.now();
			onpress();
		};
		const cancel = () => clearTimeout(timer);
		const down = (e: TouchEvent) => {
			if (e.touches.length !== 1) return cancel();
			start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
			timer = setTimeout(fire, 550);
		};
		const move = (e: TouchEvent) => {
			const t = e.touches[0];
			if (t && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) cancel();
		};
		const menu = (e: Event) => {
			e.preventDefault();
			fire();
		};
		node.addEventListener('touchstart', down, { passive: true });
		node.addEventListener('touchmove', move, { passive: true });
		node.addEventListener('touchend', cancel);
		node.addEventListener('touchcancel', cancel);
		node.addEventListener('contextmenu', menu);
		return () => {
			cancel();
			node.removeEventListener('touchstart', down);
			node.removeEventListener('touchmove', move);
			node.removeEventListener('touchend', cancel);
			node.removeEventListener('touchcancel', cancel);
			node.removeEventListener('contextmenu', menu);
		};
	};
}
