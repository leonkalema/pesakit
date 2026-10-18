import type { Pesakit } from '../client.js';
import type { IpnHandlerOptions } from '../types.js';

interface FastifyLikeRequest {
  query: unknown;
  body: unknown;
}
interface FastifyLikeReply {
  code(status: number): FastifyLikeReply;
  send(body: unknown): unknown;
}
interface FastifyLikeInstance {
  route(opts: { method: string[]; url: string; handler: (req: FastifyLikeRequest, reply: FastifyLikeReply) => Promise<unknown> }): unknown;
}

/** Fastify route handler. */
export function ipnHandler(client: Pesakit, options: IpnHandlerOptions = {}) {
  return async (req: FastifyLikeRequest, reply: FastifyLikeReply) => {
    const out = await client.handleIpn({ query: req.query as Record<string, unknown>, body: req.body }, options);
    return reply.code(out.status).send(out.body);
  };
}

/** Fastify plugin: `fastify.register(pesapalIpn, { client, path: '/pesapal/ipn', onNotification })`. */
export async function pesapalIpn(
  fastify: FastifyLikeInstance,
  opts: IpnHandlerOptions & { client: Pesakit; path?: string },
) {
  const { client, path = '/pesapal/ipn', ...handlerOptions } = opts;
  fastify.route({ method: ['GET', 'POST'], url: path, handler: ipnHandler(client, handlerOptions) });
}

