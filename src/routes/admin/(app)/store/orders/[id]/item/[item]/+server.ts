import { error } from '@sveltejs/kit';
import { getOrder, printFile } from '$lib/server/store/orders';
import type { RequestHandler } from './$types';

/** Download the photo of one order line (with the buyer's crop applied), ready for the lab. */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.admin) error(401);
	const order = getOrder(params.id);
	const file = order ? await printFile(order, params.item) : null;
	if (!file) error(404);
	return file;
};
