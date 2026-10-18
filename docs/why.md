# Why pesakit

Other Pesapal packages on npm cover `SubmitOrderRequest` and `GetTransactionStatus` and stop there. The hard parts of a Pesapal integration are the rest.

| | pesakit | typical Pesapal package |
| --- | --- | --- |
| Endpoints | All 8 (token, register IPN, list IPN, order, status, recurring, refund, cancel) | 2 to 4 |
| IPN | Parses what Pesapal sends, verifies, dedupes retries, replies in Pesapal's format | "handle it yourself" or an invented signature check |
| Pesapal errors on HTTP 200 | Raised as typed errors with the Pesapal code | Silent null fields |
| Runtimes | Node, Bun, Deno, Workers, Edge | Node only, often axios |
| Dependencies | 0 | 3 to 10 |
| Types | Generated from TypeScript source | Hand-written or none |
| Tests without credentials | `pesakit/testing` mock Pesapal | None |
| Framework adapters | Express, Fastify, Hono, Next, SvelteKit, fetch | None |
| Subscriptions, refunds, cancel | Yes | Rare |

If you are evaluating, the quickest proof is the testing kit: write your checkout and IPN flow against `createMockPesapal()` in an afternoon, then swap in real keys.
