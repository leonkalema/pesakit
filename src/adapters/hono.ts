import type { Pesakit } from '../client.js';
import type { IpnHandlerOptions } from '../types.js';

interface HonoLikeContext {
  req: {
    query(): Record<string, string>;
    json(): Promise<unknown>;
    method: string;
  };
  json(body: unknown, status?: number): Response;
}

/**
 * Hono handler. Works on Node, Bun, Deno and Cloudflare Workers.
 *
 *   app.all('/pesapal/ipn', ipnHandler(pesakit, { onNotification }))
 */
export function ipnHandler(client: Pesakit, options: IpnHandlerOptions = {}) {
  return async (c: HonoLikeContext) => {
    const body = c.req.method === 'POST' ? await c.req.json().catch(() => undefined) : undefined;
    const out = await client.handleIpn({ query: c.req.query(), body }, options);
    return c.json(out.body, out.status);
  };
}

