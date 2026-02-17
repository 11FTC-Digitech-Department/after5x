import { Injectable, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { RealTimeService, ConnectionState } from './real-time.service';
import { PollingFallbackService } from './polling-fallback.service';
import { devLog } from '../utils/logger';
import { AuthEventsService } from '../auth/auth-events.service';
import { BookingCallbacks, BookingTimelineEntry } from '../models/booking.model';

export type ConnectionMode = 'realtime' | 'polling' | 'disconnected';

export interface ManagerStatus {
  mode: ConnectionMode;
  realtimeState: ConnectionState;
  isPollingActive: boolean;
  lastEventAt: Date | null;
}

interface ManagedSubscription {
  id: string;
  type: 'booking' | 'customerBookings' | 'providerBookings';
  params: any;
  callbacks: any;
  realtimeUnsubscribe: (() => void) | null;
  pollingUnsubscribe: (() => void) | null;
}

@Injectable({
  providedIn: 'root'
})
export class RealtimeManagerService implements OnDestroy {
  private realTimeService = inject(RealTimeService);
  private pollingService = inject(PollingFallbackService);
  private authEventsService = inject(AuthEventsService);

  // Configuration
  private readonly FAILOVER_DELAY = 30000; // 30 seconds before switching to polling
  private readonly HEALTH_CHECK_INTERVAL = 60000; // Check health every 60 seconds

  // State
  private _mode = signal<ConnectionMode>('disconnected');
  private _lastEventAt = signal<Date | null>(null);
  private subscriptions = new Map<string, ManagedSubscription>();
  private failoverTimer: ReturnType<typeof setTimeout> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private connectionStateUnsubscribe: (() => void) | null = null;

  // Debug mode
  private _debugMode = signal(false);

  // Public signals
  readonly mode = this._mode.asReadonly();
  readonly connectionState = this.realTimeService.connectionState;
  readonly isConnected = computed(() =>
    this._mode() === 'realtime' && this.realTimeService.isConnected()
  );
  readonly status = computed<ManagerStatus>(() => ({
    mode: this._mode(),
    realtimeState: this.realTimeService.connectionState(),
    isPollingActive: this.pollingService.isActive(),
    lastEventAt: this._lastEventAt()
  }));

  // Auth event listener effect
  private authEventEffect = effect(() => {
    const { event } = this.authEventsService.eventTrigger();
    if (!event) return;

    if (event.type === 'SIGNED_OUT' || event.type === 'SESSION_EXPIRED') {
      this.log(`Auth event received: ${event.type}, cleaning up all subscriptions`);
      this.unsubscribeAll();
    }
  });

  constructor() {
    // Listen to realtime connection state changes
    this.connectionStateUnsubscribe = this.realTimeService.onConnectionStateChange(
      (state) => this.handleConnectionStateChange(state)
    );

    // Start health check
    this.startHealthCheck();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Enable or disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this._debugMode.set(enabled);
    this.realTimeService.setDebugMode(enabled);
    this.pollingService.setDebugMode(enabled);
  }

  private log(message: string, ...args: any[]): void {
    if (this._debugMode()) {
      devLog(`[RealtimeManager] ${message}`, ...args);
    }
  }

  private logError(message: string, ...args: any[]): void {
    console.error(`[RealtimeManager] ${message}`, ...args);
  }

  /**
   * Subscribe to a single booking's updates
   * Automatically manages realtime + polling fallback
   */
  subscribeToBooking(bookingId: string, callbacks: BookingCallbacks): () => void {
    const subscriptionId = `booking-${bookingId}`;

    // Wrap callbacks to track events
    const wrappedCallbacks: BookingCallbacks = {
      onBookingUpdate: (booking) => {
        this._lastEventAt.set(new Date());
        callbacks.onBookingUpdate?.(booking);
      },
      onStatusChange: (status, booking) => {
        this._lastEventAt.set(new Date());
        callbacks.onStatusChange?.(status, booking);
      },
      onTimelineUpdate: (entry) => {
        this._lastEventAt.set(new Date());
        callbacks.onTimelineUpdate?.(entry);
      }
    };

    // Create managed subscription
    const subscription: ManagedSubscription = {
      id: subscriptionId,
      type: 'booking',
      params: { bookingId },
      callbacks: wrappedCallbacks,
      realtimeUnsubscribe: null,
      pollingUnsubscribe: null
    };

    // Subscribe to realtime
    subscription.realtimeUnsubscribe = this.realTimeService.subscribeToBooking(
      bookingId,
      wrappedCallbacks
    );

    // Also set up polling subscription (will be started on failover)
    subscription.pollingUnsubscribe = this.pollingService.subscribeToBooking(
      bookingId,
      (booking) => {
        wrappedCallbacks.onBookingUpdate?.(booking);
        if (booking.status) {
          wrappedCallbacks.onStatusChange?.(booking.status, booking);
        }
      }
    );

    this.subscriptions.set(subscriptionId, subscription);
    this._mode.set('realtime');

    this.log(`Subscribed to booking: ${bookingId}`);

    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Subscribe to all customer bookings
   */
  subscribeToCustomerBookings(
    customerId: string,
    onBookingUpdate: (booking: any, oldStatus?: string, newStatus?: string) => void
  ): () => void {
    const subscriptionId = `customer-bookings-${customerId}`;

    // Wrap callback to track events
    const wrappedCallback = (booking: any, oldStatus?: string, newStatus?: string) => {
      this._lastEventAt.set(new Date());
      onBookingUpdate(booking, oldStatus, newStatus);
    };

    const subscription: ManagedSubscription = {
      id: subscriptionId,
      type: 'customerBookings',
      params: { customerId },
      callbacks: wrappedCallback,
      realtimeUnsubscribe: null,
      pollingUnsubscribe: null
    };

    // Subscribe to realtime
    subscription.realtimeUnsubscribe = this.realTimeService.subscribeToCustomerBookings(
      customerId,
      wrappedCallback
    );

    // Set up polling fallback
    subscription.pollingUnsubscribe = this.pollingService.subscribeToCustomerBookings(
      customerId,
      wrappedCallback
    );

    this.subscriptions.set(subscriptionId, subscription);
    this._mode.set('realtime');

    this.log(`Subscribed to customer bookings: ${customerId}`);

    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Subscribe to all provider bookings
   */
  subscribeToProviderBookings(
    providerId: string,
    onBookingUpdate: (booking: any, oldStatus?: string, newStatus?: string) => void
  ): () => void {
    const subscriptionId = `provider-bookings-${providerId}`;

    // Wrap callback to track events
    const wrappedCallback = (booking: any, oldStatus?: string, newStatus?: string) => {
      this._lastEventAt.set(new Date());
      onBookingUpdate(booking, oldStatus, newStatus);
    };

    const subscription: ManagedSubscription = {
      id: subscriptionId,
      type: 'providerBookings',
      params: { providerId },
      callbacks: wrappedCallback,
      realtimeUnsubscribe: null,
      pollingUnsubscribe: null
    };

    // Subscribe to realtime
    subscription.realtimeUnsubscribe = this.realTimeService.subscribeToProviderBookings(
      providerId,
      wrappedCallback
    );

    // Set up polling fallback
    subscription.pollingUnsubscribe = this.pollingService.subscribeToProviderBookings(
      providerId,
      wrappedCallback
    );

    this.subscriptions.set(subscriptionId, subscription);
    this._mode.set('realtime');

    this.log(`Subscribed to provider bookings: ${providerId}`);

    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Remove a subscription
   */
  private unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    subscription.realtimeUnsubscribe?.();
    subscription.pollingUnsubscribe?.();
    this.subscriptions.delete(subscriptionId);

    this.log(`Unsubscribed: ${subscriptionId}`);

    // Update mode if no more subscriptions
    if (this.subscriptions.size === 0) {
      this._mode.set('disconnected');
      this.cancelFailoverTimer();
    }
  }

  /**
   * Handle realtime connection state changes
   */
  private handleConnectionStateChange(state: ConnectionState): void {
    this.log(`Realtime connection state: ${state}`);

    switch (state) {
      case 'connected':
        this.cancelFailoverTimer();
        this.switchToRealtime();
        break;

      case 'error':
      case 'disconnected':
        // Start failover timer if we have active subscriptions
        if (this.subscriptions.size > 0 && !this.failoverTimer) {
          this.startFailoverTimer();
        }
        break;

      case 'connecting':
        // Still trying, don't switch to polling yet
        break;
    }
  }

  /**
   * Start timer for failover to polling
   */
  private startFailoverTimer(): void {
    this.log(`Starting failover timer (${this.FAILOVER_DELAY}ms)`);

    this.failoverTimer = setTimeout(() => {
      this.log('Failover timer triggered, switching to polling');
      this.switchToPolling();
    }, this.FAILOVER_DELAY);
  }

  /**
   * Cancel failover timer
   */
  private cancelFailoverTimer(): void {
    if (this.failoverTimer) {
      clearTimeout(this.failoverTimer);
      this.failoverTimer = null;
      this.log('Failover timer cancelled');
    }
  }

  /**
   * Switch to polling mode
   */
  private switchToPolling(): void {
    if (this._mode() === 'polling') return;

    this.log('Switching to polling mode');
    this._mode.set('polling');
    this.pollingService.start();
  }

  /**
   * Switch back to realtime mode
   */
  private switchToRealtime(): void {
    if (this._mode() === 'realtime') return;

    this.log('Switching to realtime mode');
    this._mode.set('realtime');
    this.pollingService.stop();
    this.realTimeService.resetConnectionState();
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Check connection health
   */
  private performHealthCheck(): void {
    if (this.subscriptions.size === 0) return;

    const lastEvent = this._lastEventAt();
    const mode = this._mode();
    const realtimeState = this.realTimeService.connectionState();

    this.log(`Health check - Mode: ${mode}, Realtime: ${realtimeState}, Last event: ${lastEvent?.toISOString()}`);

    // If in polling mode but realtime looks healthy, try switching back
    if (mode === 'polling' && realtimeState === 'connected') {
      this.log('Realtime recovered, switching back');
      this.switchToRealtime();
    }

    // If in realtime mode but no events for a long time, reconnect
    if (mode === 'realtime' && lastEvent) {
      const timeSinceLastEvent = Date.now() - lastEvent.getTime();
      if (timeSinceLastEvent > this.HEALTH_CHECK_INTERVAL * 2) {
        this.log('No recent events, triggering reconnect');
        this.realTimeService.reconnect();
      }
    }
  }

  /**
   * Force switch to polling (for testing or manual override)
   */
  forcePollingMode(): void {
    this.log('Forcing polling mode');
    this.cancelFailoverTimer();
    this.switchToPolling();
  }

  /**
   * Force switch to realtime (for testing or manual override)
   */
  forceRealtimeMode(): void {
    this.log('Forcing realtime mode');
    this.cancelFailoverTimer();
    this.switchToRealtime();
  }

  /**
   * Get current subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Cleanup all resources
   */
  private cleanup(): void {
    this.cancelFailoverTimer();

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.connectionStateUnsubscribe?.();

    // Clean up all subscriptions
    for (const [id, subscription] of this.subscriptions) {
      subscription.realtimeUnsubscribe?.();
      subscription.pollingUnsubscribe?.();
    }
    this.subscriptions.clear();

    this.pollingService.clearAll();
    this.realTimeService.unsubscribeAll();
  }

  /**
   * Unsubscribe from all and cleanup
   */
  unsubscribeAll(): void {
    for (const [id] of this.subscriptions) {
      this.unsubscribe(id);
    }
    this._mode.set('disconnected');
  }
}
