// Production entry point for Folio.
//
// Wraps the SvelteKit (adapter-node) request handler so Folio works both
// behind an HTTPS reverse proxy and when opened directly over plain HTTP,
// e.g. http://nas.local:8080 on a home network.
import http from 'node:http';

if (process.env.BASE_URL && !process.env.ORIGIN) {
	process.env.ORIGIN = process.env.BASE_URL.replace(/\/+$/, '');
}
// Reverse proxies tell us the original protocol in X-Forwarded-Proto.
process.env.PROTOCOL_HEADER ??= 'x-forwarded-proto';
// Photo uploads can be large; limits are enforced by the upload endpoint.
process.env.BODY_SIZE_LIMIT ??= 'Infinity';

const { handler } = await import('./build/handler.js');

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
	// Direct connection without a proxy and without a configured ORIGIN: it is plain HTTP.
	if (!process.env.ORIGIN && !req.headers['x-forwarded-proto']) {
		req.headers['x-forwarded-proto'] = 'http';
	}
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

server.listen(port, host, () => {
	console.log(`[folio] listening on http://${host}:${port}`);
	if (!process.env.ORIGIN) console.log('[folio] BASE_URL is not set; links in emails use the address the admin is opened on');
});

function shutdown() {
	console.log('[folio] shutting down');
	server.close(() => process.exit(0));
	server.closeIdleConnections();
	setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
