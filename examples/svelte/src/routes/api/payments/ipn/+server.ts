import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pesakit } from '$lib/server/pesakit';
import Pesakit from 'pesakit';

/**
 * Pesapal calls this URL when a transaction changes state.
 * Register it as PESAPAL_IPN_URL (GET). Pesapal needs a public URL,
 * so use a tunnel such as ngrok during development.
 */
async function handle(req: { query: Record<string, string>; body?: Record<string, unknown> }) {
  const ipn = Pesakit.parseIpn(req);
  const verification = await pesakit.verifyPayment(ipn.orderTrackingId);

  // Update your order here. verification.status is COMPLETED, FAILED, REVERSED or INVALID.
  console.log('IPN', ipn.orderMerchantReference, verification.status, verification.confirmationCode);

  return json({
    orderNotificationType: ipn.orderNotificationType,
    orderTrackingId: ipn.orderTrackingId,
    orderMerchantReference: ipn.orderMerchantReference,
    status: 200
  });
}

export const GET: RequestHandler = async ({ url }) =>
  handle({ query: Object.fromEntries(url.searchParams) });

export const POST: RequestHandler = async ({ request, url }) =>
  handle({ query: Object.fromEntries(url.searchParams), body: await request.json().catch(() => ({})) });
