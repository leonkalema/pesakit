import { describe, expect, test, beforeEach, vi } from 'vitest';
import Pesakit, { MemoryIpnStore, ValidationError, parseIpn } from '../src/index.js';
import { createMockPesapal } from '../src/testing/index.js';
import { ipnHandler as expressHandler } from '../src/adapters/express.js';
import { ipnHandler as fetchHandler } from '../src/adapters/fetch.js';
import { ipnHandler as honoHandler } from '../src/adapters/hono.js';
import { ipnHandler as svelteHandler } from '../src/adapters/sveltekit.js';
import { ipnApiHandler, ipnRouteHandler } from '../src/adapters/next.js';
import { ipnHandler as fastifyHandler, pesapalIpn } from '../src/adapters/fastify.js';

const order = { amount: 10, description: 'd', reference: 'R-1', email: 'a@b.co', callbackUrl: 'https://s.example.com/cb' };

describe('parseIpn', () => {
  test('query params, PascalCase', () => {
    expect(parseIpn({ query: { OrderTrackingId: 'abc-1', OrderMerchantReference: 'R-1', OrderNotificationType: 'IPNCHANGE' } }))
      .toEqual({ orderTrackingId: 'abc-1', orderMerchantReference: 'R-1', orderNotificationType: 'IPNCHANGE' });
  });
  test('URLSearchParams and JSON string body', () => {
    expect(parseIpn({ query: new URLSearchParams('OrderTrackingId=abc-1') }).orderTrackingId).toBe('abc-1');
    expect(parseIpn({ body: '{"orderTrackingId":"abc-2"}' }).orderTrackingId).toBe('abc-2');
  });
  test('defaults notification type', () => {
    expect(parseIpn({ body: { order_tracking_id: 'x' } }).orderNotificationType).toBe('IPNCHANGE');
  });
  test('missing id', () => {
    expect(() => parseIpn({ query: {} })).toThrow(ValidationError);
  });
});

describe('handleIpn', () => {
  let mock = createMockPesapal();
  let client: Pesakit;
  let otid: string;

  beforeEach(async () => {
    mock = createMockPesapal();
    client = new Pesakit({ ...mock.clientConfig, ipnUrl: 'https://s.example.com/ipn' });
    otid = (await client.createPayment(order)).orderTrackingId;
  });

  test('verifies, calls onNotification, acks 200', async () => {
    mock.settle(otid);
    const onNotification = vi.fn();
    const out = await client.handleIpn({ query: mock.ipnFor(otid) }, { onNotification });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ orderNotificationType: 'IPNCHANGE', orderTrackingId: otid, orderMerchantReference: 'R-1', status: 200 });
    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(onNotification.mock.calls[0][0].status).toBe('COMPLETED');
    expect(onNotification.mock.calls[0][1].orderMerchantReference).toBe('R-1');
  });

  test('dedupes retries per (id, type, status)', async () => {
    mock.settle(otid);
    const onNotification = vi.fn();
    const opts = { onNotification };
    const first = await client.handleIpn({ query: mock.ipnFor(otid) }, opts);
    const second = await client.handleIpn({ query: mock.ipnFor(otid) }, opts);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.status).toBe(200);
    expect(onNotification).toHaveBeenCalledTimes(1);
    // A status change is a new event
    mock.settle(otid, 'REVERSED');
    await client.handleIpn({ query: mock.ipnFor(otid) }, opts);
    expect(onNotification).toHaveBeenCalledTimes(2);
  });

  test('store: false disables dedupe', async () => {
    const onNotification = vi.fn();
    await client.handleIpn({ query: mock.ipnFor(otid) }, { onNotification, store: false });
    await client.handleIpn({ query: mock.ipnFor(otid) }, { onNotification, store: false });
    expect(onNotification).toHaveBeenCalledTimes(2);
  });

  test('custom async store', async () => {
    const seen = new Set<string>();
    const store = { has: async (k: string) => seen.has(k), add: async (k: string) => { seen.add(k); } };
    await client.handleIpn({ query: mock.ipnFor(otid) }, { store });
    expect(seen.size).toBe(1);
    expect([...seen][0]).toBe(`${otid}:IPNCHANGE:INVALID`);
  });

  test('onNotification throws -> 500, not marked processed', async () => {
    const onError = vi.fn();
    const out = await client.handleIpn({ query: mock.ipnFor(otid) }, { onNotification: async () => { throw new Error('db down'); }, onError });
    expect(out.status).toBe(500);
    expect(out.body.status).toBe(500);
    expect(onError).toHaveBeenCalled();
    const again = await client.handleIpn({ query: mock.ipnFor(otid) }, {});
    expect(again.duplicate).toBe(false);
  });

  test('malformed -> 400, no Pesapal call', async () => {
    mock.calls.length = 0;
    const out = await client.handleIpn({ query: {} });
    expect(out.status).toBe(400);
    expect(mock.calls).toHaveLength(0);
  });

  test('Pesapal down -> 500', async () => {
    mock.failNextWith(503);
    const out = await client.handleIpn({ query: mock.ipnFor(otid) });
    expect(out.status).toBe(500);
  });

  test('MemoryIpnStore evicts oldest', () => {
    const s = new MemoryIpnStore(2);
    s.add('a'); s.add('b'); s.add('c');
    expect(s.has('a')).toBe(false);
    expect(s.has('c')).toBe(true);
    expect(s.size).toBe(2);
  });

  describe('adapters', () => {
    const makeRes = () => {
      const res = { status: vi.fn(), json: vi.fn() };
      res.status.mockReturnValue(res);
      return res;
    };

    test('express', async () => {
      const res = makeRes();
      const next = vi.fn();
      await expressHandler(client)({ query: mock.ipnFor(otid) }, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].status).toBe(200);
      expect(next).not.toHaveBeenCalled();
    });

    test('express forwards errors on 500', async () => {
      const res = makeRes();
      const next = vi.fn();
      await expressHandler(client, { onNotification: () => { throw new Error('x'); } })({ query: mock.ipnFor(otid) }, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).toHaveBeenCalled();
    });

    test('fetch GET and POST', async () => {
      const h = fetchHandler(client);
      const q = new URLSearchParams(mock.ipnFor(otid)).toString();
      const get = await h(new Request(`https://s.example.com/ipn?${q}`));
      expect(get.status).toBe(200);
      expect((await get.json()).orderTrackingId).toBe(otid);
      const post = await h(new Request('https://s.example.com/ipn', { method: 'POST', body: JSON.stringify(mock.ipnFor(otid)), headers: { 'Content-Type': 'application/json' } }));
      expect(post.status).toBe(200);
    });

    test('next route + api', async () => {
      const q = new URLSearchParams(mock.ipnFor(otid)).toString();
      expect((await ipnRouteHandler(client)(new Request(`https://x/ipn?${q}`))).status).toBe(200);
      const res = makeRes();
      await ipnApiHandler(client)({ query: mock.ipnFor(otid) }, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('sveltekit', async () => {
      const q = new URLSearchParams(mock.ipnFor(otid)).toString();
      const r = await svelteHandler(client)({ request: new Request(`https://x/ipn?${q}`) });
      expect(r.status).toBe(200);
    });

    test('hono', async () => {
      const c = {
        req: { method: 'GET', query: () => mock.ipnFor(otid), json: async () => ({}) },
        json: (body: unknown, status?: number) => new Response(JSON.stringify(body), { status }),
      };
      const r = await honoHandler(client)(c);
      expect(r.status).toBe(200);
    });

    test('fastify handler and plugin', async () => {
      const reply = { code: vi.fn(), send: vi.fn() };
      reply.code.mockReturnValue(reply);
      await fastifyHandler(client)({ query: mock.ipnFor(otid), body: undefined }, reply);
      expect(reply.code).toHaveBeenCalledWith(200);
      const routes: unknown[] = [];
      await pesapalIpn({ route: (o) => routes.push(o) }, { client, path: '/x' });
      expect(routes).toHaveLength(1);
      expect((routes[0] as { url: string }).url).toBe('/x');
    });
  });
});
