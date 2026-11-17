import { describe, expect, it } from 'vitest';
import { clientIp } from './visitors';

const req = (headers: Record<string, string>) => new Request('http://localhost/', { headers });

describe('clientIp', () => {
	it('ignores forwarding headers from the internet', () => {
		expect(clientIp(req({ 'x-forwarded-for': '1.1.1.1' }), () => '203.0.113.9')).toBe('203.0.113.9');
	});

	it('uses the address a local proxy added, not the ones the client sent', () => {
		expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 198.51.100.7' }), () => '172.17.0.1')).toBe('198.51.100.7');
		expect(clientIp(req({ 'x-real-ip': '198.51.100.8' }), () => '127.0.0.1')).toBe('198.51.100.8');
	});

	it('falls back to the peer when a header is not an address', () => {
		expect(clientIp(req({ 'x-forwarded-for': '<script>' }), () => '::ffff:172.18.0.1')).toBe('::ffff:172.18.0.1');
	});
});
