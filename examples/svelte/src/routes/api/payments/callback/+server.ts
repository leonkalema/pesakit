import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const orderTrackingId: string | null = url.searchParams.get('OrderTrackingId');
  const merchantReference: string | null = url.searchParams.get('OrderMerchantReference');
  const payload = {
    type: 'pesapal:callback',
    orderTrackingId,
    merchantReference,
    source: 'pesakit-demo'
  } as const;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payment Callback</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 0; padding: 2rem; }
      .card { max-width: 560px; margin: 10vh auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
      .title { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; }
      .muted { color: #6b7280; font-size: 0.95rem; }
      .code { background: #f3f4f6; padding: 0.5rem 0.75rem; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.9rem; }
      .btn { margin-top: 1rem; background: #111827; color: white; border: none; padding: 0.6rem 0.9rem; border-radius: 8px; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title">Payment callback received</div>
      <p class="muted">You can safely close this window. We'll process your payment and update the status shortly.</p>
      <div class="code">OrderTrackingId: ${orderTrackingId ?? '-'}<br/>MerchantReference: ${merchantReference ?? '-'}</div>
      <button class="btn" onclick="window.close()">Close</button>
    </div>
    <script>
      try {
        const msg = ${JSON.stringify(payload)};
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, '*');
        } else if (window.opener) {
          window.opener.postMessage(msg, '*');
        }
      } catch (e) { console.error('postMessage failed', e); }
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
};
