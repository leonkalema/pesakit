import 'dotenv/config';
import Pesakit from 'pesakit';

export const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY ?? '',
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET ?? '',
  environment: (process.env.PESAPAL_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox',
  ipnUrl: process.env.PESAPAL_IPN_URL,
});
