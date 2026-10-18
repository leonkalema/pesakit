# Changelog

Managed by changesets from 4.0.0 onward. Entries below are historical.

## 4.0.0

TypeScript rewrite. Zero runtime dependencies, native fetch, runs on Node 18+, Bun, Deno, Cloudflare Workers and Vercel Edge.

- IPN dedupe store (`store` option, memory default, pluggable).
- Framework adapters: `pesakit/express`, `pesakit/fastify`, `pesakit/hono`, `pesakit/next`, `pesakit/sveltekit`, `pesakit/fetch`.
- `pesakit/testing`: mock Pesapal with the same endpoints and error codes, usable as a fetch or an HTTP server.
- `pesakit/checkout`: browser helpers for iframe checkout, callback messaging and status polling.
- Docs site, changesets, provenance publishing.
- Breaking changes listed in the migrating guide.

## 3.0.0

- Full V3 surface: `getIpnList`, `refundPayment`, `cancelOrder`, subscriptions.
- IPN handler rewritten to Pesapal's real contract (no signature, verify via status, JSON ack).
- CommonJS build, tests running, dependency cleanup.

## 2.0.5

Last 2.x release.
