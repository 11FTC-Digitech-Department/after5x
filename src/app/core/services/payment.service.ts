import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { SessionService } from '../auth/session';
import {
  PaymentStatus,
  CreateInvoiceResponse,
  CheckInvoiceStatusResponse,
  InvoiceStatus
} from '../models/payment.model';
import { RealtimeChannel } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export class VoucherError extends Error {
  constructor(message: string, public code: string = 'INVALID_VOUCHER') {
    super(message);
    this.name = 'VoucherError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);

  private invoiceChannels = new Map<string, RealtimeChannel>();

  /**
   * Create a Xendit invoice and get the payment URL
   */
  async initiatePayment(bookingId: string): Promise<CreateInvoiceResponse> {
    // Check if user is authenticated
    const session = await this.supabaseService.client.auth.getSession();
    if (!session.data.session) {
      throw new Error('Not authenticated');
    }

    console.log('[PaymentService] Calling create-xendit-invoice for booking:', bookingId);

    // Supabase client automatically includes auth token when user is authenticated
    const response = await this.supabaseService.client.functions.invoke('create-xendit-invoice', {
      body: { bookingId }
    });

    console.log('[PaymentService] Response:', response);

    if (response.error) {
      console.error('Failed to create invoice:', response.error);
      throw new Error(response.error.message || 'Failed to create payment invoice');
    }

    return response.data as CreateInvoiceResponse;
  }

  /**
   * Redeem a voucher code for a booking
   */
  async redeemVoucher(bookingId: string, code: string): Promise<{ success: boolean; voucher_code: string; voucher_amount: number; grand_total_before: number; grand_total_after: number; }> {
    const session = await this.supabaseService.client.auth.getSession();
    if (!session.data.session) {
      throw new Error('Not authenticated');
    }

    const response = await this.supabaseService.client.functions.invoke('redeem-voucher', {
      body: { bookingId, code },
      headers: environment.production ? undefined : { 'x-debug': '1' }
    });

    if (response.error) {
      let payload = response.data as any;
      if (!payload) {
        const context = (response.error as any)?.context;
        if (context && typeof context.json === 'function') {
          try {
            payload = await context.clone().json();
          } catch {
            payload = null;
          }
        }
      }
      const debug = payload?.debug;
      const errorCode = payload?.errorCode || (
        response.error.message?.toLowerCase().includes('failed to fetch') ? 'NETWORK_ERROR' : 'INVALID_VOUCHER'
      );
      const message = payload?.error || response.error.message || 'Invalid voucher code.';
      throw new VoucherError(debug ? `${message} [debug:${debug}]` : message, errorCode);
    }

    return response.data as { success: boolean; voucher_code: string; voucher_amount: number; grand_total_before: number; grand_total_after: number; };
  }

  async removeVoucher(bookingId: string): Promise<{ success: boolean; booking_id: string; grand_total_before: number; grand_total_after: number; }> {
    const session = await this.supabaseService.client.auth.getSession();
    if (!session.data.session) {
      throw new Error('Not authenticated');
    }

    const response = await this.supabaseService.client.functions.invoke('remove-voucher', {
      body: { bookingId },
      headers: environment.production ? undefined : { 'x-debug': '1' }
    });

    if (response.error) {
      const debug = (response.data as any)?.debug;
      const message = response.error.message || 'Unable to remove voucher';
      throw new Error(debug ? `${message} [debug:${debug}]` : message);
    }

    return response.data as { success: boolean; booking_id: string; grand_total_before: number; grand_total_after: number; };
  }

  /**
   * Get current payment status for a booking
   */
  async getPaymentStatus(bookingId: string): Promise<PaymentStatus> {
    const client = this.supabaseService.client;

    // Get booking status
    const { data: booking, error: bookingError } = await client
      .from('bookings')
      .select('id, status, grand_total')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Get latest invoice for this booking
    // Cast to any to handle columns that may not be in generated types yet
    const { data: invoice, error: invoiceError } = await client
      .from('invoices')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: any; error: any };

    if (invoiceError || !invoice) {
      // No invoice exists yet
      return {
        bookingId,
        invoiceId: null,
        invoiceUrl: null,
        invoiceStatus: 'NONE',
        bookingStatus: booking.status || 'unknown',
        amount: booking.grand_total,
        paidAt: null,
        paymentMethod: null,
        paymentChannel: null,
        expiresAt: null
      };
    }

    return {
      bookingId,
      invoiceId: invoice.id,
      invoiceUrl: invoice.xendit_invoice_url,
      invoiceStatus: (invoice.status || 'PENDING') as InvoiceStatus,
      bookingStatus: booking.status || 'unknown',
      amount: invoice.amount,
      paidAt: invoice.paid_at,
      paymentMethod: invoice.payment_method,
      paymentChannel: invoice.payment_channel || null,
      expiresAt: invoice.expires_at || null
    };
  }

  /**
   * Sync invoice status with Xendit (polling fallback)
   */
  async syncInvoiceStatus(bookingId: string): Promise<CheckInvoiceStatusResponse> {
    console.log('[PaymentService] syncInvoiceStatus called for booking:', bookingId);

    // Try to refresh the session first (in case we just returned from external browser)
    const { data: refreshData, error: refreshError } = await this.supabaseService.client.auth.refreshSession();

    if (refreshError) {
      console.warn('[PaymentService] Session refresh failed:', refreshError.message);
      // Continue anyway - getSession might still work
    } else {
      console.log('[PaymentService] Session refreshed successfully');
    }

    const session = await this.supabaseService.client.auth.getSession();

    console.log('[PaymentService] Session state:', {
      hasSession: !!session.data.session,
      tokenExpiry: session.data.session?.expires_at
        ? new Date(session.data.session.expires_at * 1000).toISOString()
        : null
    });

    if (!session.data.session) {
      console.error('[PaymentService] Not authenticated - no session');
      throw new Error('Not authenticated');
    }

    console.log('[PaymentService] Invoking check-invoice-status edge function');

    // Supabase client automatically includes auth token when user is authenticated
    const response = await this.supabaseService.client.functions.invoke('check-invoice-status', {
      body: { bookingId }
    });

    console.log('[PaymentService] Edge function response:', {
      data: response.data,
      error: response.error
    });

    if (response.error) {
      console.error('[PaymentService] Failed to check invoice status:', response.error);
      throw new Error(response.error.message || 'Failed to check payment status');
    }

    return response.data as CheckInvoiceStatusResponse;
  }

  /**
   * Subscribe to real-time payment status updates
   */
  subscribeToPaymentStatus(
    bookingId: string,
    callback: (status: PaymentStatus) => void
  ): () => void {
    const client = this.supabaseService.client;

    // Create channel for invoice updates
    const channel = client
      .channel(`invoice-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `booking_id=eq.${bookingId}`
        },
        async (payload) => {
          console.log('[Payment] Invoice update received:', payload);
          // Fetch full status on any change
          try {
            const status = await this.getPaymentStatus(bookingId);
            callback(status);
          } catch (error) {
            console.error('[Payment] Error fetching status:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`
        },
        async (payload) => {
          console.log('[Payment] Booking update received:', payload);
          // Fetch full status on booking change
          try {
            const status = await this.getPaymentStatus(bookingId);
            callback(status);
          } catch (error) {
            console.error('[Payment] Error fetching status:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Payment] Subscription status:', status);
      });

    this.invoiceChannels.set(bookingId, channel);

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
      this.invoiceChannels.delete(bookingId);
    };
  }

  /**
   * Check if booking requires payment
   */
  bookingRequiresPayment(bookingStatus: string): boolean {
    return bookingStatus === 'payment_pending';
  }

  /**
   * Check if invoice is expired
   */
  isInvoiceExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  /**
   * Format payment method for display
   */
  formatPaymentMethod(method: string | null, channel: string | null): string {
    if (!method && !channel) return 'Unknown';

    const methodDisplayMap: Record<string, string> = {
      'CREDIT_CARD': 'Credit Card',
      'DEBIT_CARD': 'Debit Card',
      'GCASH': 'GCash',
      'GRAB_PAY': 'GrabPay',
      'PAYMAYA': 'PayMaya',
      'BPI': 'BPI Online',
      'UNIONBANK': 'UnionBank',
      'CEBUANA': 'Cebuana',
      'ECPAY': 'ECPay',
      '7ELEVEN': '7-Eleven'
    };

    const displayMethod = methodDisplayMap[method || ''] || method;
    const displayChannel = methodDisplayMap[channel || ''] || channel;

    if (displayChannel && displayChannel !== displayMethod) {
      return `${displayMethod} (${displayChannel})`;
    }

    return displayMethod || displayChannel || 'Unknown';
  }
}
