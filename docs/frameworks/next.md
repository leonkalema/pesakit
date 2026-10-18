# Next.js

## App router

`app/api/pesapal/ipn/route.ts`:

```ts
import Pesakit from 'pesakit';
import { ipnRouteHandler } from 'pesakit/next';

const pesakit = new Pesakit({ /* env */ });
const handler = ipnRouteHandler(pesakit, { onNotification: async (v, ipn) => { /* ... */ } });

export const GET = handler;
export const POST = handler;
```

Creating payments: a server action or route handler that calls `pesakit.createPayment()` and returns `redirectUrl`.

## Pages router

`pages/api/pesapal/ipn.ts`:

```ts
import { ipnApiHandler } from 'pesakit/next';
export default ipnApiHandler(pesakit, { onNotification });
```

## Edge runtime

The core has no Node dependencies. `export const runtime = 'edge'` works with the app router handler.
