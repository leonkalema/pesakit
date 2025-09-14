import 'dotenv/config';
import axios from 'axios';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PaymentFormSchema } from '$lib/types.js';
import Pesakit from 'pesakit';

// Debug environment variables
console.log('Environment variables check:');
console.log('PESAPAL_CONSUMER_KEY:', process.env.PESAPAL_CONSUMER_KEY ? 'SET' : 'NOT SET');
console.log('PESAPAL_CONSUMER_SECRET:', process.env.PESAPAL_CONSUMER_SECRET ? 'SET' : 'NOT SET');

const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY || 'K6KoQabQeQkK5ZrPM67cbujFwhgrB6r1',
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET || 'qgQnnnPF5fSqrJNEIDJOEoAuHTI=',
  environment: (process.env.PESAPAL_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  timeout: 30000,
  retries: 3,
  enableLogging: true,
  logLevel: 'info'
});

// --- Pesapal IPN discovery/registration helpers (server-side, no FE involved) ---
const BASE_URL: string =
  (process.env.PESAPAL_ENVIRONMENT || 'sandbox') === 'production'
    ? 'https://pay.pesapal.com/v3'
    : 'https://cybqa.pesapal.com/pesapalv3';

let cachedNotificationId: string | null = null;

async function getAuthToken(): Promise<string> {
  const url = `${BASE_URL}/api/Auth/RequestToken`;
  try {
    console.log('Pesapal auth URL:', url.replace(process.env.PESAPAL_CONSUMER_SECRET ?? '', '***'));
    const consumerKey = String(process.env.PESAPAL_CONSUMER_KEY ?? '').trim();
    const consumerSecret = String(process.env.PESAPAL_CONSUMER_SECRET ?? '').trim();
    const mask = (s: string) => (s ? `${s.slice(0, 3)}***${s.slice(-3)}` : '');
    console.log('Pesapal creds (masked):', {
      key: mask(consumerKey),
      secret: mask(consumerSecret)
    });
    const res = await axios.post(
      url,
      {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret
      },
      {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );
    const token = String(res.data?.token || '');
    if (!token) {
      console.error('Pesapal auth failed: empty token', {
        status: res.status,
        data: res.data
      });
      throw new Error('Failed to obtain Pesapal token');
    }
    console.log('Pesapal auth success. Token length:', token.length);
    return token;
  } catch (err) {
    console.error('Pesapal auth request error:', err);
    throw new Error('Pesapal auth request failed');
  }
}

async function getIpnList(token: string): Promise<Array<{ url: string; ipn_id: string }>> {
  const res = await axios.get(`${BASE_URL}/api/URLSetup/GetIpnList`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
  });
  return (res.data as Array<{ url: string; ipn_id: string }>);
}

async function registerIpn(token: string, url: string, method: 'GET' | 'POST' = 'GET'): Promise<string> {
  const res = await axios.post(
    `${BASE_URL}/api/URLSetup/RegisterIPN`,
    { url, ipn_notification_type: method },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    }
  );
  return (res.data?.ipn_id as string);
}

async function ensureNotificationId(): Promise<string> {
  if (cachedNotificationId) return cachedNotificationId;
  const ipnUrl: string | undefined = process.env.PESAPAL_IPN_URL;
  if (!ipnUrl) throw new Error('PESAPAL_IPN_URL is required');
  const token: string = await getAuthToken();
  const list = await getIpnList(token);
  const found = list.find((i) => i.url === ipnUrl);
  if (found?.ipn_id) {
    cachedNotificationId = found.ipn_id;
    return cachedNotificationId;
  }
  const ipnId = await registerIpn(token, ipnUrl, 'GET');
  if (!ipnId) throw new Error('Failed to register IPN URL');
  cachedNotificationId = ipnId;
  return cachedNotificationId;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    
    // Validate request data
    const validatedData = PaymentFormSchema.parse(body);
    
    // Resolve notificationId (discover existing or register once), then create payment
    let notificationId: string;
    try {
      notificationId = await ensureNotificationId();
    } catch (e) {
      console.error('Failed to resolve Pesapal IPN notificationId:', e);
      return json(
        {
          success: false,
          error: 'Failed to initialize payment (IPN setup). Please try again shortly.',
        },
        { status: 502 }
      );
    }
    const paymentData = { ...validatedData, notificationId };
    console.log('Payment data being sent:', JSON.stringify(paymentData, null, 2));
    const result = (await pesakit.createPayment(paymentData)) as unknown as {
      orderTrackingId: string;
      merchantReference: string;
      redirectUrl: string;
    };
    
    return json({
      success: true,
      orderTrackingId: result.orderTrackingId,
      merchantReference: result.merchantReference,
      redirectUrl: result.redirectUrl,
      correlationId: `pesakit-${Date.now()}`
    });
    
  } catch (error) {
    console.error('Payment creation failed:', error);
    
    if (error instanceof Error) {
      return json({
        success: false,
        error: error.message,
        correlationId: `pesakit-error-${Date.now()}`
      }, { status: 400 });
    }
    
    return json({
      success: false,
      error: 'Payment creation failed',
      correlationId: `pesakit-error-${Date.now()}`
    }, { status: 500 });
  }
};
