import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Pesakit from 'pesakit';

const pesakit = new Pesakit({
  consumerKey: 'K6KoQabQeQkK5ZrPM67cbujFwhgrB6r1',
  consumerSecret: 'qgQnnnPF5fSqrJNEIDJOEoAuHTI=',
  environment: 'sandbox',
  timeout: 30000,
  retries: 3,
  enableLogging: true,
  logLevel: 'info'
});

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { orderTrackingId } = params;
    
    if (!orderTrackingId) {
      return json({
        success: false,
        error: 'Order tracking ID is required'
      }, { status: 400 });
    }
    
    // Verify payment using PesaKit
    const verification = await pesakit.verifyPayment(orderTrackingId);
    
    return json({
      success: true,
      verification,
      correlationId: `pesakit-verify-${Date.now()}`
    });
    
  } catch (error) {
    console.error('Payment verification failed:', error);
    
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return json({
        success: false,
        error: error.message,
        correlationId: `pesakit-verify-error-${Date.now()}`
      }, { status: statusCode });
    }
    
    return json({
      success: false,
      error: 'Payment verification failed',
      correlationId: `pesakit-verify-error-${Date.now()}`
    }, { status: 500 });
  }
};
