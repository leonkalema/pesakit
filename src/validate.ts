import { ValidationError } from './errors.js';
import type {
  PaymentRequest,
  PesakitConfig,
  RefundRequest,
  SubscriptionDetails,
  IpnNotificationType,
} from './types.js';

type Issue = { field: string; message: string };

class Issues {
  list: Issue[] = [];
  add(field: string, message: string) {
    this.list.push({ field, message });
  }
  throwIfAny(label: string) {
    if (this.list.length) {
      const summary = this.list.map((i) => `${i.field}: ${i.message}`).join('; ');
      throw new ValidationError(`${label} validation failed: ${summary}`, { fields: this.list });
    }
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isHttpUrl(v: unknown): v is string {
  if (!isStr(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9]{7,15}$/;
const REFERENCE = /^[A-Za-z0-9\-_.:]{1,50}$/;
const DDMMYYYY = /^\d{2}-\d{2}-\d{4}$/;
const TRACKING_ID = /^[A-Za-z0-9\-_]{1,100}$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateConfig(config: PesakitConfig): PesakitConfig {
  const v = new Issues();
  if (!config || typeof config !== 'object') throw new ValidationError('Configuration must be an object');
  if (!isStr(config.consumerKey) || config.consumerKey.length < 8) v.add('consumerKey', 'required, at least 8 chars');
  if (!isStr(config.consumerSecret) || config.consumerSecret.length < 8) v.add('consumerSecret', 'required, at least 8 chars');
  if (config.environment !== undefined && config.environment !== 'sandbox' && config.environment !== 'production') {
    v.add('environment', "must be 'sandbox' or 'production'");
  }
  if (config.baseUrl !== undefined && !isHttpUrl(config.baseUrl)) v.add('baseUrl', 'must be an http(s) URL');
  if (config.ipnUrl !== undefined && !isHttpUrl(config.ipnUrl)) v.add('ipnUrl', 'must be an http(s) URL');
  if (config.ipnNotificationType !== undefined && config.ipnNotificationType !== 'GET' && config.ipnNotificationType !== 'POST') {
    v.add('ipnNotificationType', "must be 'GET' or 'POST'");
  }
  if (config.timeoutMs !== undefined && (!isNum(config.timeoutMs) || config.timeoutMs < 100)) v.add('timeoutMs', 'must be >= 100');
  if (config.fetch !== undefined && typeof config.fetch !== 'function') v.add('fetch', 'must be a function');
  v.throwIfAny('Configuration');
  return config;
}

function validateSubscription(s: SubscriptionDetails, v: Issues) {
  if (!isStr(s.accountNumber) || !s.accountNumber.trim()) v.add('subscription.accountNumber', 'required');
  if (!isStr(s.startDate) || !DDMMYYYY.test(s.startDate)) v.add('subscription.startDate', 'must be DD-MM-YYYY');
  if (!isStr(s.endDate) || !DDMMYYYY.test(s.endDate)) v.add('subscription.endDate', 'must be DD-MM-YYYY');
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(s.frequency)) {
    v.add('subscription.frequency', 'must be DAILY, WEEKLY, MONTHLY or YEARLY');
  }
}

export function validatePaymentRequest(data: PaymentRequest): PaymentRequest {
  const v = new Issues();
  if (!data || typeof data !== 'object') throw new ValidationError('Payment request must be an object');
  if (!isNum(data.amount) || data.amount <= 0) v.add('amount', 'must be a positive number');
  if (!isStr(data.description) || !data.description.trim()) v.add('description', 'required');
  else if (data.description.length > 100) v.add('description', 'max 100 chars');
  if (!isStr(data.reference) || !REFERENCE.test(data.reference)) {
    v.add('reference', 'required, max 50 chars, letters, digits, - _ . :');
  }
  if (!isHttpUrl(data.callbackUrl)) v.add('callbackUrl', 'must be an http(s) URL');
  if (data.cancellationUrl !== undefined && !isHttpUrl(data.cancellationUrl)) v.add('cancellationUrl', 'must be an http(s) URL');
  if (data.ipnUrl !== undefined && !isHttpUrl(data.ipnUrl)) v.add('ipnUrl', 'must be an http(s) URL');
  if (data.email !== undefined && (!isStr(data.email) || !EMAIL.test(data.email))) v.add('email', 'invalid email');
  if (data.phoneNumber !== undefined && (!isStr(data.phoneNumber) || !PHONE.test(data.phoneNumber))) {
    v.add('phoneNumber', 'digits only, optional leading +, 7 to 15 digits');
  }
  if (data.email === undefined && data.phoneNumber === undefined) v.add('email', 'provide email or phoneNumber');
  if (data.currency !== undefined && (!isStr(data.currency) || !/^[A-Z]{3}$/.test(data.currency))) {
    v.add('currency', 'must be a 3 letter ISO 4217 code');
  }
  if (data.notificationId !== undefined && (!isStr(data.notificationId) || !GUID.test(data.notificationId))) {
    v.add('notificationId', 'must be a GUID');
  }
  if (data.redirectMode !== undefined && data.redirectMode !== 'TOP_WINDOW' && data.redirectMode !== 'PARENT_WINDOW') {
    v.add('redirectMode', "must be 'TOP_WINDOW' or 'PARENT_WINDOW'");
  }
  if (data.billingAddress?.countryCode !== undefined && !/^[A-Z]{2}$/.test(data.billingAddress.countryCode)) {
    v.add('billingAddress.countryCode', 'must be ISO 3166-1 alpha-2');
  }
  if (data.billingAddress?.state !== undefined && data.billingAddress.state.length > 3) {
    v.add('billingAddress.state', 'max 3 chars');
  }
  if (data.subscription !== undefined) validateSubscription(data.subscription, v);
  v.throwIfAny('Payment request');
  return data;
}

export function validateTrackingId(id: unknown): string {
  if (!isStr(id) || !TRACKING_ID.test(id)) {
    throw new ValidationError('Order tracking ID validation failed: required, letters, digits, - _', {
      fields: [{ field: 'orderTrackingId', message: 'invalid' }],
    });
  }
  return id;
}

export function validateIpnRegistration(url: unknown, type: unknown): { url: string; type: IpnNotificationType } {
  const v = new Issues();
  if (!isHttpUrl(url)) v.add('url', 'must be an http(s) URL');
  if (type !== 'GET' && type !== 'POST') v.add('notificationType', "must be 'GET' or 'POST'");
  v.throwIfAny('IPN registration');
  return { url: url as string, type: type as IpnNotificationType };
}

export function validateRefund(data: RefundRequest): RefundRequest {
  const v = new Issues();
  if (!data || typeof data !== 'object') throw new ValidationError('Refund request must be an object');
  if (!isStr(data.confirmationCode) || !data.confirmationCode.trim()) v.add('confirmationCode', 'required');
  if (!isNum(data.amount) || data.amount <= 0) v.add('amount', 'must be a positive number');
  if (!isStr(data.username) || !data.username.trim()) v.add('username', 'required');
  if (!isStr(data.remarks) || !data.remarks.trim()) v.add('remarks', 'required');
  v.throwIfAny('Refund');
  return data;
}
