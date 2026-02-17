import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { CustomerBooking } from '../models/booking.model';
import { devLog } from '../utils/logger';

export interface PollingSubscription {
  id: string;
  type: 'booking' | 'customerBookings' | 'providerBookings';
  entityId: string; // bookingId, customerId, or providerId
  callback: (data: any, oldStatus?: string, newStatus?: string) => void;
  lastState: any;
}

@Injectable({
  providedIn: 'root'
})
export class PollingFallbackService implements OnDestroy {
  private supabaseService = inject(SupabaseService);

  // Polling configuration
  private readonly POLL_INTERVAL = 15000; // 15 seconds
  private readonly MAX_POLL_ERRORS = 5;

  // State
  private _isActive = signal(false);
  private _pollErrors = signal(0);
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private subscriptions = new Map<string, PollingSubscription>();

  // Debug mode
  private _debugMode = signal(false);

  // Public signals
  readonly isActive = this._isActive.asReadonly();
  readonly pollErrors = this._pollErrors.asReadonly();

  ngOnDestroy(): void {
    this.stop();
  }

  /**
   * Enable or disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this._debugMode.set(enabled);
  }

  private log(message: string, ...args: any[]): void {
    if (this._debugMode()) {
      devLog(`[PollingFallback] ${message}`, ...args);
    }
  }

  private logError(message: string, ...args: any[]): void {
    console.error(`[PollingFallback] ${message}`, ...args);
  }

  /**
   * Start polling for all active subscriptions
   */
  start(): void {
    if (this._isActive()) {
      this.log('Polling already active');
      return;
    }

    this.log('Starting polling fallback');
    this._isActive.set(true);
    this._pollErrors.set(0);

    // Poll immediately, then set interval
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), this.POLL_INTERVAL);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this._isActive()) return;

    this.log('Stopping polling fallback');
    this._isActive.set(false);

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Subscribe to a single booking's updates via polling
   */
  subscribeToBooking(
    bookingId: string,
    callback: (booking: any) => void
  ): () => void {
    const subscriptionId = `booking-${bookingId}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'booking',
      entityId: bookingId,
      callback,
      lastState: null
    });

    this.log(`Added booking subscription: ${subscriptionId}`);
    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Subscribe to all customer bookings via polling
   */
  subscribeToCustomerBookings(
    customerId: string,
    callback: (booking: any, oldStatus?: string, newStatus?: string) => void
  ): () => void {
    const subscriptionId = `customer-bookings-${customerId}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'customerBookings',
      entityId: customerId,
      callback,
      lastState: new Map<string, any>() // Track multiple bookings
    });

    this.log(`Added customer bookings subscription: ${subscriptionId}`);
    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Subscribe to all provider bookings via polling
   */
  subscribeToProviderBookings(
    providerId: string,
    callback: (booking: any, oldStatus?: string, newStatus?: string) => void
  ): () => void {
    const subscriptionId = `provider-bookings-${providerId}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'providerBookings',
      entityId: providerId,
      callback,
      lastState: new Map<string, any>()
    });

    this.log(`Added provider bookings subscription: ${subscriptionId}`);
    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Remove a subscription
   */
  private unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
    this.log(`Removed subscription: ${subscriptionId}`);

    // Stop polling if no more subscriptions
    if (this.subscriptions.size === 0 && this._isActive()) {
      this.stop();
    }
  }

  /**
   * Clear all subscriptions
   */
  clearAll(): void {
    this.subscriptions.clear();
    this.stop();
  }

  /**
   * Perform a single poll cycle for all subscriptions
   */
  private async poll(): Promise<void> {
    if (this.subscriptions.size === 0) return;

    this.log('Polling...');

    try {
      for (const [id, subscription] of this.subscriptions) {
        await this.pollSubscription(subscription);
      }

      // Reset error counter on success
      this._pollErrors.set(0);
    } catch (error) {
      const errors = this._pollErrors() + 1;
      this._pollErrors.set(errors);
      this.logError(`Poll error (${errors}/${this.MAX_POLL_ERRORS}):`, error);

      if (errors >= this.MAX_POLL_ERRORS) {
        this.logError('Max poll errors reached, stopping polling');
        this.stop();
      }
    }
  }

  /**
   * Poll a single subscription
   */
  private async pollSubscription(subscription: PollingSubscription): Promise<void> {
    switch (subscription.type) {
      case 'booking':
        await this.pollSingleBooking(subscription);
        break;
      case 'customerBookings':
        await this.pollCustomerBookings(subscription);
        break;
      case 'providerBookings':
        await this.pollProviderBookings(subscription);
        break;
    }
  }

  /**
   * Poll a single booking
   */
  private async pollSingleBooking(subscription: PollingSubscription): Promise<void> {
    const { data, error } = await this.supabaseService.client
      .from('bookings')
      .select('*')
      .eq('id', subscription.entityId)
      .single();

    if (error) {
      this.logError(`Error polling booking ${subscription.entityId}:`, error);
      return;
    }

    if (!data) return;

    // Check if state changed
    const lastState = subscription.lastState;
    if (!lastState || this.hasBookingChanged(lastState, data)) {
      this.log(`Booking ${subscription.entityId} changed`);
      subscription.lastState = { ...data };
      subscription.callback(data);
    }
  }

  /**
   * Poll all customer bookings
   */
  private async pollCustomerBookings(subscription: PollingSubscription): Promise<void> {
    const { data: bookings, error } = await this.supabaseService.client
      .from('bookings')
      .select('*')
      .eq('customer_id', subscription.entityId)
      .order('created_at', { ascending: false })
      .limit(20); // Limit to recent bookings

    if (error) {
      this.logError(`Error polling customer bookings:`, error);
      return;
    }

    if (!bookings) return;

    const stateMap = subscription.lastState as Map<string, any>;

    for (const booking of bookings) {
      const lastState = stateMap.get(booking.id);

      if (!lastState) {
        // New booking
        this.log(`New customer booking detected: ${booking.id}`);
        stateMap.set(booking.id, { ...booking });
        subscription.callback(booking, undefined, booking.status ?? undefined);
      } else if (this.hasBookingChanged(lastState, booking)) {
        // Updated booking
        const oldStatus = lastState.status ?? undefined;
        const newStatus = booking.status ?? undefined;
        this.log(`Customer booking ${booking.id} changed: ${oldStatus} -> ${newStatus}`);
        stateMap.set(booking.id, { ...booking });
        subscription.callback(booking, oldStatus, newStatus);
      }
    }
  }

  /**
   * Poll all provider bookings
   */
  private async pollProviderBookings(subscription: PollingSubscription): Promise<void> {
    const { data: bookings, error } = await this.supabaseService.client
      .from('bookings')
      .select('*')
      .eq('provider_id', subscription.entityId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      this.logError(`Error polling provider bookings:`, error);
      return;
    }

    if (!bookings) return;

    const stateMap = subscription.lastState as Map<string, any>;

    for (const booking of bookings) {
      const lastState = stateMap.get(booking.id);

      if (!lastState) {
        // New booking
        this.log(`New provider booking detected: ${booking.id}`);
        stateMap.set(booking.id, { ...booking });
        subscription.callback(booking, undefined, booking.status ?? undefined);
      } else if (this.hasBookingChanged(lastState, booking)) {
        // Updated booking
        const oldStatus = lastState.status ?? undefined;
        const newStatus = booking.status ?? undefined;
        this.log(`Provider booking ${booking.id} changed: ${oldStatus} -> ${newStatus}`);
        stateMap.set(booking.id, { ...booking });
        subscription.callback(booking, oldStatus, newStatus);
      }
    }
  }

  /**
   * Check if a booking has meaningful changes
   */
  private hasBookingChanged(oldState: any, newState: any): boolean {
    // Check key fields that indicate a meaningful change
    const keysToCheck = [
      'status',
      'provider_id',
      'scheduled_for',
      'final_amount',
      'payment_status',
      'updated_at'
    ];

    for (const key of keysToCheck) {
      if (oldState[key] !== newState[key]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}
