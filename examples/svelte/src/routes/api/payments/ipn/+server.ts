import { ipnHandler } from 'pesakit/sveltekit';
import { pesakit } from '$lib/server/pesakit';

/**
 * Pesapal calls this URL when a transaction changes state.
 * Register it as PESAPAL_IPN_URL. Use a tunnel such as ngrok in development.
 */
const handler = ipnHandler(pesakit, {
  onNotification: async (verification, ipn) => {
    // Runs once per (order, status). Update your order here.
    console.log('IPN', ipn.orderMerchantReference, verification.status, verification.confirmationCode);
  },
});

export const GET = handler;
export const POST = handler;
