import type { Pesakit } from '../client.js';
import type { IpnHandlerOptions } from '../types.js';
import { ipnHandler as fetchHandler } from './fetch.js';

/**
 * Next.js app router (app/api/pesapal/ipn/route.ts):
 *
 *   const handler = ipnRouteHandler(pesakit, { onNotification });
 *   export const GET = handler;
 *   export const POST = handler;
 */
export const ipnRouteHandler = fetchHandler;

interface PagesReq {
  query?: Record<string, unknown>;
  body?: unknown;
}
interface PagesRes {
  status(code: number): PagesRes;
  json(body: unknown): unknown;
}

/**
 * Next.js pages router (pages/api/pesapal/ipn.ts):
 *
 *   export default ipnApiHandler(pesakit, { onNotification });
 */
export function ipnApiHandler(client: Pesakit, options: IpnHandlerOptions = {}) {
  return async (req: PagesReq, res: PagesRes) => {
    const out = await client.handleIpn({ query: req.query, body: req.body }, options);
    res.status(out.status).json(out.body);
  };
}

