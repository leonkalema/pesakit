import type { Pesakit } from '../client.js';
import type { IpnHandlerOptions } from '../types.js';

interface Req {
  query?: Record<string, unknown>;
  body?: unknown;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): unknown;
}
type Next = (error?: unknown) => void;

/**
 * Express or Connect middleware for Pesapal IPNs.
 *
 *   app.all('/pesapal/ipn', ipnHandler(pesakit, { onNotification }))
 *
 * Mount with `app.all` so both GET and POST IPN types work.
 * Needs `express.json()` before it for POST IPNs.
 */
export function ipnHandler(client: Pesakit, options: IpnHandlerOptions = {}) {
  return async (req: Req, res: Res, next?: Next) => {
    const out = await client.handleIpn({ query: req.query, body: req.body }, options);
    res.status(out.status).json(out.body);
    if (out.status === 500 && next) next(out.error);
  };
}

