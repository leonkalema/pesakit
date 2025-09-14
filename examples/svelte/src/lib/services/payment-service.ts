import type { PaymentFormData, PaymentResponse, VerificationResponse, ApiError } from '../types.js';

class PaymentService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = '/api';
  }

  /**
   * Create a payment request
   */
  async createPayment(paymentData: PaymentFormData): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Payment creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment creation failed'
      };
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(orderTrackingId: string): Promise<VerificationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/verify/${orderTrackingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Payment verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment verification failed'
      };
    }
  }

  /**
   * Poll payment status until completion or timeout
   */
  async pollPaymentStatus(
    orderTrackingId: string, 
    maxAttempts: number = 30,
    intervalMs: number = 2000
  ): Promise<VerificationResponse> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const result = await this.verifyPayment(orderTrackingId);
      
      if (!result.success) {
        return result;
      }

      if (result.verification?.status === 'COMPLETED' || result.verification?.status === 'FAILED') {
        return result;
      }

      attempts++;
      await this.delay(intervalMs);
    }

    return {
      success: false,
      error: 'Payment verification timeout'
    };
  }

  /**
   * Get health status of payment service
   */
  async getHealthStatus(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Format currency amount for display
   */
  formatCurrency(amount: number, currency: string): string {
    const formatters: Record<string, Intl.NumberFormat> = {
      KES: new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }),
      USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      UGX: new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }),
      TZS: new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS' }),
    };

    const formatter = formatters[currency];
    if (!formatter) {
      return `${currency} ${amount.toFixed(2)}`;
    }

    return formatter.format(amount);
  }

  /**
   * Generate unique reference ID
   */
  generateReference(prefix: string = 'PAY'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    const kenyanPhoneRegex = /^\+254[17]\d{8}$/;
    return kenyanPhoneRegex.test(phoneNumber);
  }

  /**
   * Extract order tracking ID from payment URL
   */
  extractOrderTrackingId(paymentUrl: string): string | null {
    try {
      const url = new URL(paymentUrl);
      return url.searchParams.get('OrderTrackingId') || 
             url.searchParams.get('orderTrackingId') ||
             url.pathname.split('/').pop() || null;
    } catch {
      return null;
    }
  }

  /**
   * Handle API errors consistently
   */
  handleApiError(error: unknown): ApiError {
    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'API_ERROR'
      };
    }

    if (typeof error === 'object' && error !== null) {
      const apiError = error as any;
      return {
        message: apiError.message || 'An unexpected error occurred',
        code: apiError.code || 'UNKNOWN_ERROR',
        statusCode: apiError.statusCode,
        correlationId: apiError.correlationId
      };
    }

    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR'
    };
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default PaymentService;
