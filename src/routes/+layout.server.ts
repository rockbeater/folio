import { getStudio } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	const { favicon } = getStudio();
	return { favicon: favicon ? `/branding/${favicon}` : null };
};
