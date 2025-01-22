declare module 'pesakit' {
  interface PesapalConfig {
    consumerKey: string;
    consumerSecret: string;
    environment?: 'sandbox' | 'production';
  }

  interface PaymentData {
    amount: number;
    description: string;
    reference: string;
    email: string;
    callbackUrl: string;
  }

  interface PaymentVerification {
    status: string;
    method: string;
    amount: number;
    currency: string;
  }

  class Pesakit {
    constructor(config: PesapalConfig);
    getOAuthToken(): Promise<string>;
    createPayment(paymentData: PaymentData): Promise<string>;
    verifyPayment(orderTrackingId: string): Promise<PaymentVerification>;
    createIpnHandler(): (req: any, res: any, next: any) => Promise<void>;
  }

  export = Pesakit;
}
