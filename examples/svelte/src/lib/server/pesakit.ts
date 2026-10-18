import 'dotenv/config';
import Pesakit from 'pesakit';

/**
 * One shared client for the whole server. The IPN URL is registered
 * with Pesapal on the first payment and reused after that.
 */
export const pesakit = new Pesakit({
  consumerKey: process.env.PESAPAL_CONSUMER_KEY ?? '',
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET ?? '',
  environment: (process.env.PESAPAL_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox',
  ipnUrl: process.env.PESAPAL_IPN_URL,
  enableLogging: process.env.NODE_ENV !== 'test',
  logLevel: 'info'
});
