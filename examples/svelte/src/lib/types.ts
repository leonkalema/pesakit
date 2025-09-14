import { z } from 'zod';

// Payment form validation schema
export const PaymentFormSchema = z.object({
  amount: z.number().min(1, 'Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required').max(200, 'Description too long'),
  reference: z.string().min(1, 'Reference is required').max(50, 'Reference too long'),
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  phoneNumber: z.string().regex(/^\+254\d{9}$/, 'Phone number must be in format +254XXXXXXXXX'),
  currency: z.enum(['KES', 'USD', 'UGX', 'TZS']).default('KES'),
  callbackUrl: z.string().url('Invalid callback URL')
});

export type PaymentFormData = z.infer<typeof PaymentFormSchema>;

// API Response types
export interface PaymentResponse {
  success: boolean;
  paymentUrl?: string;
  error?: string;
  correlationId?: string;
}

export interface PaymentVerification {
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
  method?: string;
  amount?: number;
  currency?: string;
  merchantReference?: string;
  timestamp?: string;
}

export interface VerificationResponse {
  success: boolean;
  verification?: PaymentVerification;
  error?: string;
  correlationId?: string;
}

// UI State types
export type PaymentStep = 'form' | 'processing' | 'redirect' | 'verification' | 'success' | 'error';

export interface PaymentState {
  step: PaymentStep;
  formData: Partial<PaymentFormData>;
  paymentUrl?: string;
  orderTrackingId?: string;
  verification?: PaymentVerification;
  error?: string;
  isLoading: boolean;
}

// Component prop types
export interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  show: boolean;
  onClose: () => void;
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white';
}

export interface PaymentCardProps {
  title: string;
  description: string;
  amount: number;
  currency: string;
  onSelect: (data: Partial<PaymentFormData>) => void;
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  correlationId?: string;
}

// Form validation error type
export interface ValidationErrors {
  [key: string]: string[];
}

// Currency options
export const CURRENCIES = [
  { value: 'KES', label: 'Kenyan Shilling (KES)', symbol: 'KSh' },
  { value: 'USD', label: 'US Dollar (USD)', symbol: '$' },
  { value: 'UGX', label: 'Ugandan Shilling (UGX)', symbol: 'USh' },
  { value: 'TZS', label: 'Tanzanian Shilling (TZS)', symbol: 'TSh' }
] as const;

// Sample products for demo
export const SAMPLE_PRODUCTS = [
  {
    id: 'premium-plan',
    name: 'Premium Plan',
    description: 'Access to all premium features for 1 month',
    amount: 90,
    currency: 'KES' as const,
    image: '💎'
  },
  {
    id: 'basic-plan',
    name: 'Basic Plan',
    description: 'Essential features for small businesses',
    amount: 200,
    currency: 'KES' as const,
    image: '⭐'
  },
  {
    id: 'enterprise-plan',
    name: 'Enterprise Plan',
    description: 'Full suite with priority support',
    amount: 9999,
    currency: 'KES' as const,
    image: '🚀'
  }
] as const;

export type Product = typeof SAMPLE_PRODUCTS[number];
