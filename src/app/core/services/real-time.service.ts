import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { BookingCallbacks, BookingTimelineEntry } from '../models/booking.model';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ConnectionStatus {
  state: ConnectionState;
  lastConnectedAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  reconnectAttempts: number;
}

@Injectable({
  providedIn: 'root'
})
export class RealTimeService {
  private supabaseService = inject(SupabaseService);
  private channels = new Map<string, RealtimeChannel>();

  // Connection monitoring
  private _connectionState = signal<ConnectionState>('disconnected');
  private _lastConnectedAt = signal<Date | null>(null);
  private _lastErrorAt = signal<Date | null>(null);
  private _lastError = signal<string | null>(null);
  private _reconnectAttempts = signal(0);

  // Debug mode toggle
  private _debugMode = signal(false);

  // Public signals
  readonly connectionState = this._connectionState.asReadonly();
  readonly isConnected = computed(() => this._connectionState() === 'connected');
  readonly connectionStatus = computed<ConnectionStatus>(() => ({
    state: this._connectionState(),
    lastConnectedAt: this._lastConnectedAt(),
    lastErrorAt: this._lastErrorAt(),
    lastError: this._lastError(),
    reconnectAttempts: this._reconnectAttempts()
  }));

  // Connection state change callbacks
  private connectionCallbacks: Set<(state: ConnectionState) => void> = new Set();

  // Exponential backoff settings
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 1000; // 1 second
  private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds

  // Track active subscriptions for reconnection
  private activeSubscriptions = new Map<string, () => void>();

  /**
   * Enable or disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this._debugMode.set(enabled);
  }

  /**
   * Register a callback for connection state changes
   */
  onConnectionStateChange(callback: (state: ConnectionState) => void): () => void {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  private notifyConnectionStateChange(state: ConnectionState): void {
    this._connectionState.set(state);
    this.connectionCallbacks.forEach(cb => cb(state));
  }

  private log(message: string, ...args: any[]): void {
    if (this._debugMode()) {
      console.log(`[RealTimeService] ${message}`, ...args);
    }
  }

  private logError(message: string, ...args: any[]): void {
    console.error(`[RealTimeService] ${message}`, ...args);
  }

  private handleSubscriptionStatus(
    channelName: string,
    status: `${REALTIME_SUBSCRIBE_STATES}`,
    err?: Error
  ): void {
    this.log(`Channel ${channelName} status:`, status);

    switch (status) {
      case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
        this._connectionState.set('connected');
        this._lastConnectedAt.set(new Date());
        this._reconnectAttempts.set(0);
        this.notifyConnectionStateChange('connected');
        break;

      case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
        this._connectionState.set('error');
        this._lastErrorAt.set(new Date());
        this._lastError.set(err?.message || 'Channel error');
        this.notifyConnectionStateChange('error');
        this.logError(`Channel error for ${channelName}:`, err);
        break;

      case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
        this._connectionState.set('error');
        this._lastErrorAt.set(new Date());
        this._lastError.set('Connection timed out');
        this.notifyConnectionStateChange('error');
        this.logError(`Channel ${channelName} timed out`);
        break;

      case REALTIME_SUBSCRIBE_STATES.CLOSED:
        this._connectionState.set('disconnected');
        this.notifyConnectionStateChange('disconnected');
        break;
    }
  }

  private calculateReconnectDelay(): number {
    const attempts = this._reconnectAttempts();
    // Exponential backoff with jitter
    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, attempts),
      this.MAX_RECONNECT_DELAY
    );
    // Add random jitter (0-25% of delay)
    return delay + Math.random() * delay * 0.25;
  }

  /**
   * Attempt to reconnect all active subscriptions
   */
  async reconnect(): Promise<void> {
    const attempts = this._reconnectAttempts();

    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logError('Max reconnection attempts reached');
      this._connectionState.set('error');
      this._lastError.set('Max reconnection attempts reached');
      return;
    }

    this._reconnectAttempts.set(attempts + 1);
    this._connectionState.set('connecting');
    this.notifyConnectionStateChange('connecting');

    const delay = this.calculateReconnectDelay();
    this.log(`Reconnecting in ${delay}ms (attempt ${attempts + 1})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    // Re-subscribe all active subscriptions
    for (const [channelName, resubscribe] of this.activeSubscriptions) {
      this.log(`Re-subscribing to ${channelName}`);
      resubscribe();
    }
  }

  /**
   * Reset connection state (call after successful reconnection)
   */
  resetConnectionState(): void {
    this._reconnectAttempts.set(0);
    this._lastError.set(null);
  }

  subscribeToBooking(bookingId: string, callbacks: BookingCallbacks): () => void {
    const client = this.supabaseService.client;
    const channelName = `booking-${bookingId}`;

    // Remove existing subscription if any
    this.unsubscribeFromBooking(bookingId);

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          callbacks.onBookingUpdate?.(payload.new);
          callbacks.onStatusChange?.(payload.new.status, payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_timeline',
          filter: `booking_id=eq.${bookingId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const timelineEntry: BookingTimelineEntry = {
            id: payload.new.id,
            bookingId: payload.new.booking_id,
            title: payload.new.title,
            description: payload.new.description,
            iconName: payload.new.icon_name,
            createdAt: new Date(payload.new.created_at),
            metadata: payload.new.metadata
          };
          callbacks.onTimelineUpdate?.(timelineEntry);
        }
      )
      .subscribe((status, err) => {
        this.handleSubscriptionStatus(channelName, status, err);
      });

    this.channels.set(bookingId, channel);

    // Store resubscribe function for reconnection
    this.activeSubscriptions.set(channelName, () => this.subscribeToBooking(bookingId, callbacks));

    // Return unsubscribe function
    return () => this.unsubscribeFromBooking(bookingId);
  }

  unsubscribeFromBooking(bookingId: string): void {
    const channelName = `booking-${bookingId}`;
    const channel = this.channels.get(bookingId);
    if (channel) {
      this.supabaseService.client.removeChannel(channel);
      this.channels.delete(bookingId);
      this.activeSubscriptions.delete(channelName);
    }
  }

  /**
   * Subscribe to all booking updates for a specific customer
   */
  subscribeToCustomerBookings(
    customerId: string,
    onBookingUpdate: (booking: any, oldStatus?: string, newStatus?: string) => void
  ): () => void {
    const client = this.supabaseService.client;
    const channelName = `customer-bookings-${customerId}`;

    this.log(`Setting up customer bookings subscription: ${channelName}`);

    // Remove existing subscription if any
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      this.log(`Removing existing channel: ${channelName}`);
      client.removeChannel(existingChannel);
      this.channels.delete(channelName);
    }

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${customerId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const oldStatus = (payload.old as any)?.status;
          const newStatus = payload.new.status;

          this.log('UPDATE event received:', {
            bookingId: payload.new.id,
            oldStatus,
            newStatus,
            hasOldRecord: !!payload.old && Object.keys(payload.old).length > 0,
            oldRecordKeys: payload.old ? Object.keys(payload.old) : []
          });

          // Warn if old record is missing (indicates REPLICA IDENTITY issue)
          if (!payload.old || Object.keys(payload.old).length === 0) {
            console.warn(
              '[RealTimeService] UPDATE event missing old record data. ' +
              'This may indicate REPLICA IDENTITY FULL is not set on the bookings table. ' +
              'Run migration: ALTER TABLE public.bookings REPLICA IDENTITY FULL;'
            );
          }

          onBookingUpdate(payload.new, oldStatus, newStatus);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${customerId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.log('INSERT event received:', {
            bookingId: payload.new.id,
            status: payload.new.status
          });

          onBookingUpdate(payload.new, undefined, payload.new.status);
        }
      )
      .subscribe((status, err) => {
        this.log(`Subscription status for ${channelName}:`, status);
        this.handleSubscriptionStatus(channelName, status, err);
      });

    this.channels.set(channelName, channel);

    // Store resubscribe function for reconnection
    this.activeSubscriptions.set(channelName, () =>
      this.subscribeToCustomerBookings(customerId, onBookingUpdate)
    );

    this.log(`Channel registered: ${channelName}, Total active: ${this.channels.size}`);

    return () => {
      this.log(`Unsubscribing from channel: ${channelName}`);
      const ch = this.channels.get(channelName);
      if (ch) {
        client.removeChannel(ch);
        this.channels.delete(channelName);
        this.activeSubscriptions.delete(channelName);
      }
    };
  }

  /**
   * Subscribe to all booking updates for a specific provider
   */
  subscribeToProviderBookings(
    providerId: string,
    onBookingUpdate: (booking: any, oldStatus?: string, newStatus?: string) => void
  ): () => void {
    const client = this.supabaseService.client;
    const channelName = `provider-bookings-${providerId}`;

    this.log(`Setting up provider bookings subscription: ${channelName}`);

    // Remove existing subscription if any
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      this.log(`Removing existing channel: ${channelName}`);
      client.removeChannel(existingChannel);
      this.channels.delete(channelName);
    }

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${providerId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const oldStatus = (payload.old as any)?.status;
          const newStatus = payload.new.status;

          this.log('UPDATE event received (provider):', {
            bookingId: payload.new.id,
            oldStatus,
            newStatus,
            hasOldRecord: !!payload.old && Object.keys(payload.old).length > 0
          });

          onBookingUpdate(payload.new, oldStatus, newStatus);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${providerId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.log('INSERT event received (provider):', {
            bookingId: payload.new.id,
            status: payload.new.status
          });

          onBookingUpdate(payload.new, undefined, payload.new.status);
        }
      )
      .subscribe((status, err) => {
        this.log(`Subscription status for ${channelName}:`, status);
        this.handleSubscriptionStatus(channelName, status, err);
      });

    this.channels.set(channelName, channel);

    // Store resubscribe function for reconnection
    this.activeSubscriptions.set(channelName, () =>
      this.subscribeToProviderBookings(providerId, onBookingUpdate)
    );

    this.log(`Channel registered: ${channelName}, Total active: ${this.channels.size}`);

    return () => {
      this.log(`Unsubscribing from channel: ${channelName}`);
      const ch = this.channels.get(channelName);
      if (ch) {
        client.removeChannel(ch);
        this.channels.delete(channelName);
        this.activeSubscriptions.delete(channelName);
      }
    };
  }

  subscribeToProviderLocation(
    providerId: string,
    bookingId: string,
    onLocationUpdate: (location: { lat: number; lng: number; timestamp: Date }) => void
  ): () => void {
    const client = this.supabaseService.client;
    const channelName = `provider-location-${providerId}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_gps_logs',
          filter: `provider_id=eq.${providerId},booking_id=eq.${bookingId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          if (payload.new.location) {
            const location = {
              lat: payload.new.location.coordinates[1], // PostGIS stores as [lng, lat]
              lng: payload.new.location.coordinates[0],
              timestamp: new Date(payload.new.recorded_at || payload.new.created_at)
            };
            onLocationUpdate(location);
          }
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      client.removeChannel(channel);
    };
  }

  subscribeToNotifications(
    userId: string,
    onNotification: (notification: any) => void
  ): () => void {
    const client = this.supabaseService.client;
    const channelName = `notifications-${userId}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          onNotification(payload.new);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }

  subscribeToProviderStatus(
    providerId: string,
    onStatusChange: (status: string, provider: any) => void
  ): () => void {
    const client = this.supabaseService.client;
    const channelName = `provider-status-${providerId}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'providers',
          filter: `id=eq.${providerId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          if ((payload.new as any).status !== (payload.old as any)?.status) {
            onStatusChange((payload.new as any).status, payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }

  /**
   * Subscribe to provider availability changes for service details page.
   * Used to update the provider list in real-time when providers go online/offline.
   * @param onProviderStatusChange Callback when any provider's status changes
   * @returns Unsubscribe function
   */
  subscribeToProviderAvailability(
    onProviderStatusChange: (providerId: string, status: string, onlineSince: Date | null) => void
  ): () => void {
    const client = this.supabaseService.client;
    const channelName = `provider-availability-${Date.now()}`;

    this.log(`Setting up provider availability subscription: ${channelName}`);

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'providers'
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const oldStatus = (payload.old as any)?.status;
          const newStatus = (payload.new as any).status;

          // Only trigger callback if status actually changed
          if (oldStatus !== newStatus) {
            const providerId = (payload.new as any).id;
            const onlineSince = (payload.new as any).online_since
              ? new Date((payload.new as any).online_since)
              : null;

            this.log('Provider status change:', {
              providerId,
              oldStatus,
              newStatus,
              onlineSince
            });

            onProviderStatusChange(providerId, newStatus, onlineSince);
          }
        }
      )
      .subscribe((status, err) => {
        this.handleSubscriptionStatus(channelName, status, err);
      });

    return () => {
      this.log(`Unsubscribing from channel: ${channelName}`);
      client.removeChannel(channel);
    };
  }

  // Broadcast location update for provider
  async broadcastProviderLocation(
    bookingId: string,
    providerId: string,
    location: { lat: number; lng: number },
    additionalData?: {
      batteryLevel?: number;
      heading?: number;
      speedKmh?: number;
    }
  ): Promise<void> {
    const client = this.supabaseService.client;

    const gpsLog = {
      booking_id: bookingId,
      provider_id: providerId,
      location: `POINT(${location.lng} ${location.lat})`, // PostGIS format: lng lat
      battery_level: additionalData?.batteryLevel,
      heading: additionalData?.heading,
      speed_kmh: additionalData?.speedKmh,
      recorded_at: new Date().toISOString()
    };

    const { error } = await client
      .from('booking_gps_logs')
      .insert(gpsLog);

    if (error) {
      console.error('Failed to broadcast provider location:', error);
    }
  }

  // Send typing indicator for chat
  async broadcastTyping(
    bookingId: string,
    userId: string,
    isTyping: boolean
  ): Promise<void> {
    const client = this.supabaseService.client;

    await client
      .channel(`booking-chat-${bookingId}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId,
          isTyping,
          timestamp: new Date().toISOString()
        }
      });
  }

  // Subscribe to chat messages
  subscribeToChat(
    bookingId: string,
    onMessage: (message: any) => void,
    onTyping?: (typingData: { userId: string; isTyping: boolean }) => void
  ): () => void {
    const client = this.supabaseService.client;
    const channelName = `booking-chat-${bookingId}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_chats',
          filter: `booking_id=eq.${bookingId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          onMessage(payload.new);
        }
      )
      .on(
        'broadcast',
        { event: 'typing' },
        (payload: any) => {
          onTyping?.(payload.payload);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }

  // Cleanup all subscriptions
  unsubscribeAll(): void {
    for (const [bookingId, channel] of this.channels) {
      this.supabaseService.client.removeChannel(channel);
    }
    this.channels.clear();
    this.activeSubscriptions.clear();
    this._connectionState.set('disconnected');
  }

  /**
   * Get the number of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return this.channels.size;
  }

  /**
   * Check if a specific channel is subscribed
   */
  isSubscribed(channelName: string): boolean {
    return this.channels.has(channelName) || this.activeSubscriptions.has(channelName);
  }
}