# Fastify

```ts
import Fastify from 'fastify';
import Pesakit from 'pesakit';
import { pesapalIpn } from 'pesakit/fastify';

const fastify = Fastify();
const pesakit = new Pesakit({ /* env */ });

fastify.register(pesapalIpn, {
  client: pesakit,
  path: '/pesapal/ipn',
  onNotification: async (v, ipn) => { /* ... */ },
});
```

Or the bare handler:

```ts
import { ipnHandler } from 'pesakit/fastify';
fastify.route({ method: ['GET', 'POST'], url: '/pesapal/ipn', handler: ipnHandler(pesakit, { onNotification }) });
```
