# SvelteKit

`src/lib/server/pesakit.ts`:

```ts
import Pesakit from 'pesakit';
import { env } from '$env/dynamic/private';

export const pesakit = new Pesakit({
  consumerKey: env.PESAPAL_CONSUMER_KEY,
  consumerSecret: env.PESAPAL_CONSUMER_SECRET,
  environment: env.PESAPAL_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  ipnUrl: env.PESAPAL_IPN_URL,
});
```

`src/routes/api/pesapal/ipn/+server.ts`:

```ts
import { ipnHandler } from 'pesakit/sveltekit';
import { pesakit } from '$lib/server/pesakit';

const handler = ipnHandler(pesakit, { onNotification: async (v, ipn) => { /* ... */ } });
export const GET = handler;
export const POST = handler;
```

A full SvelteKit app with iframe checkout, callback `postMessage` and status polling is in [`examples/svelte`](https://github.com/leonkalema/pesakit/tree/main/examples/svelte).
