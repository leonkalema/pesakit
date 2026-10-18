import { ValidationError } from './errors.js';
import { validateTrackingId } from './validate.js';
import type { IpnInput, IpnNotification, IpnStore } from './types.js';

/** In-memory dedupe store with a bounded size. Fine for a single process. */
export class MemoryIpnStore implements IpnStore {
  private readonly keys = new Set<string>();
  constructor(private readonly max = 10_000) {}

  has(key: string) {
    return this.keys.has(key);
  }

  add(key: string) {
    if (this.keys.size >= this.max) {
      const first = this.keys.values().next().value;
      if (first !== undefined) this.keys.delete(first);
    }
    this.keys.add(key);
  }

  get size() {
    return this.keys.size;
  }
}

function toRecord(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (input instanceof URLSearchParams) return Object.fromEntries(input.entries());
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof input === 'object') return input as Record<string, unknown>;
  return {};
}

const KEYS = {
  orderTrackingId: ['OrderTrackingId', 'orderTrackingId', 'order_tracking_id', 'ordertrackingid'],
  orderMerchantReference: ['OrderMerchantReference', 'orderMerchantReference', 'order_merchant_reference', 'ordermerchantreference'],
  orderNotificationType: ['OrderNotificationType', 'orderNotificationType', 'order_notification_type', 'ordernotificationtype'],
};

function pick(source: Record<string, unknown>, names: string[]): string | undefined {
  for (const n of names) {
    const v = source[n];
    if (v !== undefined && v !== null && String(v) !== '') return String(v);
  }
  return undefined;
}

/**
 * Parse a Pesapal IPN. Pesapal sends OrderTrackingId, OrderMerchantReference
 * and OrderNotificationType as query params (GET) or a JSON body (POST).
 */
export function parseIpn(input: IpnInput): IpnNotification {
  const source = { ...toRecord(input.query), ...toRecord(input.body) };
  const orderTrackingId = pick(source, KEYS.orderTrackingId);
  if (!orderTrackingId) {
    throw new ValidationError('IPN is missing OrderTrackingId', {
      fields: [{ field: 'OrderTrackingId', message: 'required' }],
    });
  }
  return {
    orderTrackingId: validateTrackingId(orderTrackingId),
    orderMerchantReference: pick(source, KEYS.orderMerchantReference),
    orderNotificationType: pick(source, KEYS.orderNotificationType) ?? 'IPNCHANGE',
  };
}

export function ipnDedupeKey(orderTrackingId: string, status: string, notificationType: string) {
  return `${orderTrackingId}:${notificationType}:${status}`;
}
