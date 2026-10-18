import type { Pesakit } from '../client.js';
import type { IpnHandlerOptions } from '../types.js';

/**
 * Web standard Request -> Response handler. Use it anywhere that speaks
 * fetch: Next.js app router, SvelteKit, Remix, Astro, Nitro, Bun.serve,
 * Deno.serve, Cloudflare Workers.
 *
 *   export const GET = ipnHandler(pesakit, { onNotification });
 *   export const POST = GET;
 */
export function ipnHandler(client: Pesakit, options: IpnHandlerOptions = {}) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json().catch(() => undefined) : undefined;
    const out = await client.handleIpn({ query: url.searchParams, body }, options);
    return new Response(JSON.stringify(out.body), {
      status: out.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

