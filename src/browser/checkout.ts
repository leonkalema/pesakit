/**
 * pesakit/checkout: browser side helpers for the Pesapal hosted page.
 * No secrets here. Your server creates the order and gives the browser
 * `redirectUrl` and `orderTrackingId`.
 */

export interface CallbackMessage {
  type: 'pesapal:callback';
  orderTrackingId: string | null;
  merchantReference: string | null;
}

export interface MountOptions {
  /** Element or selector that receives the iframe. */
  container: HTMLElement | string;
  /** redirectUrl from createPayment(). Create the order with redirectMode: 'PARENT_WINDOW'. */
  redirectUrl: string;
  /** Fired when your callback page posts a message (see `postCallbackMessage`). */
  onCallback?: (message: CallbackMessage) => void;
  /** Origin of your callback page. Default: current origin. */
  expectedOrigin?: string;
  /** Extra attributes for the iframe. */
  iframe?: Partial<Pick<HTMLIFrameElement, 'width' | 'height' | 'title'>> & { className?: string };
}

export interface MountedCheckout {
  iframe: HTMLIFrameElement;
  destroy(): void;
}

/** Load the Pesapal page in an iframe and listen for your callback page. */
export function mountCheckout(opts: MountOptions): MountedCheckout {
  const container = typeof opts.container === 'string' ? document.querySelector<HTMLElement>(opts.container) : opts.container;
  if (!container) throw new Error('pesakit/checkout: container not found');
  const iframe = document.createElement('iframe');
  iframe.src = opts.redirectUrl;
  iframe.width = opts.iframe?.width ?? '100%';
  iframe.height = opts.iframe?.height ?? '700';
  iframe.title = opts.iframe?.title ?? 'Pesapal checkout';
  if (opts.iframe?.className) iframe.className = opts.iframe.className;
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allow', 'payment');
  container.appendChild(iframe);

  const origin = opts.expectedOrigin ?? window.location.origin;
  const listener = (event: MessageEvent) => {
    if (event.origin !== origin) return;
    const data = event.data as CallbackMessage | undefined;
    if (data && data.type === 'pesapal:callback') opts.onCallback?.(data);
  };
  window.addEventListener('message', listener);

  return {
    iframe,
    destroy() {
      window.removeEventListener('message', listener);
      iframe.remove();
    },
  };
}

/**
 * Call this from your callback page (the `callbackUrl` you gave Pesapal).
 * It tells the parent window or opener that checkout finished.
 */
export function postCallbackMessage(targetOrigin: string = window.location.origin): CallbackMessage {
  const params = new URLSearchParams(window.location.search);
  const message: CallbackMessage = {
    type: 'pesapal:callback',
    orderTrackingId: params.get('OrderTrackingId'),
    merchantReference: params.get('OrderMerchantReference'),
  };
  const target = window.parent !== window ? window.parent : window.opener;
  if (target) target.postMessage(message, targetOrigin);
  return message;
}

export interface PollOptions {
  /** Ms between checks. Default 2000. */
  intervalMs?: number;
  /** Stop after this many ms. Default 120000. */
  timeoutMs?: number;
  /** Statuses that stop polling. Default: anything but INVALID. */
  isFinal?: (status: string) => boolean;
  signal?: AbortSignal;
}

/**
 * Poll your own status endpoint until the payment is final.
 * `check` returns the status string from verifyPayment() on your server.
 */
export async function pollStatus(check: () => Promise<string>, opts: PollOptions = {}): Promise<string> {
  const interval = opts.intervalMs ?? 2000;
  const deadline = Date.now() + (opts.timeoutMs ?? 120_000);
  const isFinal = opts.isFinal ?? ((s) => s !== 'INVALID' && s !== '');
  for (;;) {
    if (opts.signal?.aborted) throw new Error('pesakit/checkout: polling aborted');
    const status = await check();
    if (isFinal(status)) return status;
    if (Date.now() >= deadline) throw new Error('pesakit/checkout: polling timed out');
    await new Promise((r) => setTimeout(r, interval));
  }
}
