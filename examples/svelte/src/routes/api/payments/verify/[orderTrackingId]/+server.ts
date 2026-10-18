import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pesakit } from '$lib/server/pesakit';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const verification = await pesakit.verifyPayment(params.orderTrackingId);
    return json({ success: true, verification });
  } catch (error) {
    console.error('Payment verification failed:', error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Payment verification failed' },
      { status }
    );
  }
};
