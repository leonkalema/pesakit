import type { Pesakit } from '../client.js';
import type { IpnHandlerOptions } from '../types.js';
import { ipnHandler as fetchHandler } from './fetch.js';

interface RequestEventLike {
  request: Request;
}

/**
 * SvelteKit (src/routes/api/pesapal/ipn/+server.ts):
 *
 *   const handler = ipnHandler(pesakit, { onNotification });
 *   export const GET = handler;
 *   export const POST = handler;
 */
export function ipnHandler(client: Pesakit, options: IpnHandlerOptions = {}) {
  const h = fetchHandler(client, options);
  return (event: RequestEventLike) => h(event.request);
}

