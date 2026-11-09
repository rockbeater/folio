import { error } from '@sveltejs/kit';
import { getOrder, printZip } from '$lib/server/store/orders';
import type { RequestHandler } from './$types';

/** The order's print files as one ZIP (crops applied). */
export const GET: RequestHandler = ({ params, locals }) => {
	if (!locals.admin) error(401);
	const order = getOrder(params.id);
	const zip = order ? printZip(order) : null;
	if (!zip) error(404);
	return zip;
};
