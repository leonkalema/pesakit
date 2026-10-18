---
layout: home
hero:
  name: pesakit
  text: Pesapal API 3.0 for JavaScript
  tagline: Zero dependencies. Runs on Node, Bun, Deno and edge. Typed. Tested without credentials.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/client
features:
  - title: Every V3 endpoint
    details: Token, IPN registration and listing, orders, subscriptions, status, refunds, cancellation.
  - title: IPN done right
    details: Parses what Pesapal sends, verifies with GetTransactionStatus, dedupes retries, replies the way Pesapal expects.
  - title: Framework adapters
    details: pesakit/express, pesakit/next, pesakit/sveltekit, pesakit/hono, pesakit/fastify, pesakit/fetch.
  - title: Mock Pesapal
    details: pesakit/testing is a fake Pesapal with the same error codes. Test checkout, IPN and refunds offline.
---
