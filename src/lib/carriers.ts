// Shipping carriers and their tracking pages. The list is a store setting (Store → Shipping):
// carriers change their tracking addresses now and then, so the photographer can edit them.

export interface Carrier {
	id: string;
	name: string;
	/** Tracking page; {tracking_number} is replaced by the shipment's number. */
	url: string;
}

export const TRACKING_PLACEHOLDER = '{tracking_number}';

/**
 * Starting list. PostNord and GLS are their tracking links as sent to customers (the country part,
 * dk / DK/da, picks the site's country and language); UPS, FedEx, DHL Express and USPS follow the
 * open tracking_number_data set (github.com/jkeen/tracking_number_data); DPD and Bring are their
 * public tracking pages. Everything can be changed under Store → Shipping.
 */
export const DEFAULT_CARRIERS: Carrier[] = [
	{ id: 'postnord', name: 'PostNord', url: 'https://tracking.postnord.com/dk/tracking?id={tracking_number}' },
	{ id: 'gls', name: 'GLS', url: 'https://gls-group.eu/DK/da/find-pakke?match={tracking_number}&txtAction=71000' },
	{ id: 'dpd', name: 'DPD', url: 'https://tracking.dpd.de/status/en_US/parcel/{tracking_number}' },
	{ id: 'bring', name: 'Bring', url: 'https://tracking.bring.com/tracking/{tracking_number}' },
	{ id: 'dhl', name: 'DHL Express', url: 'https://www.dhl.com/en/express/tracking.html?brand=DHL&AWB={tracking_number}' },
	{ id: 'ups', name: 'UPS', url: 'https://wwwapps.ups.com/WebTracking/track?track=yes&trackNums={tracking_number}' },
	{ id: 'fedex', name: 'FedEx', url: 'https://www.fedex.com/apps/fedextrack/?tracknumbers={tracking_number}' },
	{ id: 'usps', name: 'USPS', url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking_number}' }
];

function slug(name: string): string {
	return (
		name
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 40) || 'carrier'
	);
}

/** A clean list: named carriers with an http(s) tracking address (or none), unique ids, at most 30. */
export function normalizeCarriers(input: unknown): Carrier[] {
	if (!Array.isArray(input)) return DEFAULT_CARRIERS.map((c) => ({ ...c }));
	const out: Carrier[] = [];
	const ids = new Set<string>();
	for (const item of input.slice(0, 30)) {
		const c = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
		const name = typeof c.name === 'string' ? c.name.trim().slice(0, 60) : '';
		if (!name) continue;
		const url = typeof c.url === 'string' ? c.url.trim().slice(0, 500) : '';
		let id = typeof c.id === 'string' && /^[a-z0-9-]{1,40}$/.test(c.id) ? c.id : slug(name);
		for (let n = 2; ids.has(id); n++) id = `${slug(name)}-${n}`;
		ids.add(id);
		out.push({ id, name, url: /^https?:\/\//i.test(url) ? url : '' });
	}
	return out;
}

/** The tracking page for a shipment, or null when the carrier has no page (or none is chosen). */
export function trackingUrl(carriers: Carrier[], carrierId: string | null | undefined, number: string | null | undefined): string | null {
	const carrier = carriers.find((c) => c.id === carrierId);
	if (!carrier?.url || !number) return null;
	return carrier.url.includes(TRACKING_PLACEHOLDER) ? carrier.url.split(TRACKING_PLACEHOLDER).join(encodeURIComponent(number.trim())) : carrier.url;
}
