// app/api/pesapal/ipn/route.ts
import Pesakit from 'pesakit';
import { ipnRouteHandler } from 'pesakit/next';

const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY!,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET!,
  environment: process.env.PESAPAL_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  ipnUrl: process.env.PESAPAL_IPN_URL,
});

const handler = ipnRouteHandler(pesakit, {
  onNotification: async (verification, ipn) => {
    // await db.orders.update({ where: { reference: ipn.orderMerchantReference }, data: { status: verification.status } });
    console.log('IPN', ipn.orderMerchantReference, verification.status);
  },
});

export const GET = handler;
export const POST = handler;
