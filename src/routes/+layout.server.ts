import { getPreferences, getStudio } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	const { favicon } = getStudio();
	return {
		favicon: favicon ? `/branding/${favicon}` : null,
		/** How photos are saved on each kind of device; used by every download button. */
		downloadPrefs: getPreferences().downloads
	};
};
