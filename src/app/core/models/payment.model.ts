// Payment and Wallet interfaces for Xendit integration

export type InvoiceStatus = 'NONE' | 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
export type PaymentMethodType = 'EWALLET' | 'CARD' | 'BANK_TRANSFER' | 'RETAIL_OUTLET' | 'QR_CODE';
export type WalletTransactionType = 'CREDIT' | 'DEBIT' | 'WITHDRAWAL' | 'ADJUSTMENT';

export interface PaymentStatus {
  bookingId: string;
  invoiceId: string | null;
  invoiceUrl: string | null;
  invoiceStatus: InvoiceStatus;
  bookingStatus: string;
  amount: number | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentChannel: string | null;
  expiresAt: string | null;
  needsSync?: boolean;
  synced?: boolean;
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoiceId: string | null;
  invoiceUrl: string;
  xenditInvoiceId: string;
  amount: number;
  expiresAt: string;
  isExisting: boolean;
  error?: string;
}

export interface CheckInvoiceStatusResponse {
  success: boolean;
  bookingId: string;
  bookingStatus: string;
  invoiceStatus: InvoiceStatus;
  invoiceId: string | null;
  invoiceUrl: string | null;
  amount: number | null;
  paidAt?: string;
  paymentMethod?: string;
  paymentChannel?: string;
  expiresAt?: string;
  needsSync: boolean;
  synced?: boolean;
  xenditError?: boolean;
  error?: string;
}

export interface Invoice {
  id: string;
  booking_id: string;
  customer_id: string;
  xendit_invoice_id: string | null;
  xendit_invoice_url: string | null;
  payment_method: string | null;
  payment_method_type: PaymentMethodType | null;
  payment_channel: string | null;
  amount: number;
  status: InvoiceStatus;
  paid_at: string | null;
  fees_paid_amount: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletBalance {
  walletId: string | null;
  available: number;
  frozen: number;
  currency: string;
  lastUpdated: string | null;
}

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  description: string | null;
  bookingId: string | null;
  createdAt: string;
}

export interface WalletData {
  wallet_id: string;
  balance: number;
  frozen_balance: number;
  currency: string;
  last_transaction_at: string | null;
}

export interface WalletTransactionRow {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  booking_id: string | null;
  created_at: string;
}
