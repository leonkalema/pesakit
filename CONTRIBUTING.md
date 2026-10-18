# Contributing

```bash
git clone https://github.com/leonkalema/pesakit
cd pesakit
npm install
npm test
```

## Layout

- `src/client.ts`: the Pesakit class. Every HTTP call goes through `request()`.
- `src/ipn.ts`: IPN parsing and the dedupe store.
- `src/adapters/`: one file per framework, each a thin wrapper around `client.handleIpn()`.
- `src/testing/`: the mock Pesapal.
- `src/browser/`: browser-only helpers. No secrets, no Node APIs.
- `test/`: vitest. Everything runs against the mock; `test/live.test.ts` hits the sandbox when `PESAPAL_*` env vars are set.
- `docs/`: VitePress.

## Rules

- Zero runtime dependencies. If you need one, open an issue first.
- No Node builtins in `src/` except behind a dynamic import in `src/testing/`.
- Match Pesapal's documented behaviour, not what seems sensible. Link the doc page in the PR.
- Every endpoint change needs a test against the mock and a docs update.
- Run `npx changeset` for anything a user would notice.

## Release

Merging to `main` with pending changesets opens a version PR. Merging that PR publishes to npm with provenance and deploys the docs.

## Security

See [SECURITY.md](SECURITY.md).
