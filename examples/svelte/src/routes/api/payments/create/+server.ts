import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PaymentFormSchema } from '$lib/types.js';
import { pesakit } from '$lib/server/pesakit';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const paymentData = PaymentFormSchema.parse(body);

    // notificationId is resolved by the client from PESAPAL_IPN_URL.
    const result = await pesakit.createPayment(paymentData);

    return json({
      success: true,
      orderTrackingId: result.orderTrackingId,
      merchantReference: result.merchantReference,
      redirectUrl: result.redirectUrl
    });
  } catch (error) {
    console.error('Payment creation failed:', error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Payment creation failed' },
      { status }
    );
  }
};
