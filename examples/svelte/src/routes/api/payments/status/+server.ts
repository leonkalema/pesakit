import 'dotenv/config';
import axios from 'axios';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BASE_URL: string =
  (process.env.PESAPAL_ENVIRONMENT || 'sandbox') === 'production'
    ? 'https://pay.pesapal.com/v3'
    : 'https://cybqa.pesapal.com/pesapalv3';

async function getAuthToken(): Promise<string> {
  const url = `${BASE_URL}/api/Auth/RequestToken`;
  const consumer_key = String(process.env.PESAPAL_CONSUMER_KEY ?? '').trim();
  const consumer_secret = String(process.env.PESAPAL_CONSUMER_SECRET ?? '').trim();
  if (!consumer_key || !consumer_secret) {
    throw new Error('Missing PESAPAL_CONSUMER_KEY or PESAPAL_CONSUMER_SECRET');
  }
  const res = await axios.post(
    url,
    { consumer_key, consumer_secret },
    { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 5000 }
  );
  const token = String(res.data?.token || '');
  if (!token) throw new Error('Failed to obtain Pesapal token');
  return token;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const orderTrackingId = url.searchParams.get('orderTrackingId');
    if (!orderTrackingId) {
      return json({ success: false, error: 'orderTrackingId is required' }, { status: 400 });
    }

    const token = await getAuthToken();
    const statusUrl = `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`;
    const res = await axios.get(statusUrl, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      timeout: 7000
    });

    const data = res.data as {
      payment_method?: string;
      amount?: number;
      created_date?: string;
      confirmation_code?: string;
      payment_status_description?: string;
      description?: string;
      message?: string;
      payment_account?: string;
      call_back_url?: string;
      status_code?: number;
      merchant_reference?: string;
      currency?: string;
      error?: unknown;
      status?: string;
    };

    return json({
      success: true,
      orderTrackingId,
      statusCode: data.status_code ?? null,
      paymentStatusDescription: data.payment_status_description ?? null,
      message: data.message ?? null,
      confirmationCode: data.confirmation_code ?? null,
      merchantReference: data.merchant_reference ?? null,
      amount: data.amount ?? null,
      currency: data.currency ?? null
    });
  } catch (e: any) {
    const status = e?.response?.status ?? 502;
    return json({ success: false, error: e?.message || 'Status check failed' }, { status });
  }
};
