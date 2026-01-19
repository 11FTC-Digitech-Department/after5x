import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { BookingCallbacks, BookingTimelineEntry } from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class RealTimeService {
  private supabaseService = inject(SupabaseService);
  private channels = new Map<string, RealtimeChannel>();

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
      .subscribe((status) => {
        console.log(`Booking subscription status for ${bookingId}:`, status);
      });

    this.channels.set(bookingId, channel);

    // Return unsubscribe function
    return () => this.unsubscribeFromBooking(bookingId);
  }

  unsubscribeFromBooking(bookingId: string): void {
    const channel = this.channels.get(bookingId);
    if (channel) {
      this.supabaseService.client.removeChannel(channel);
      this.channels.delete(bookingId);
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

    // Remove existing subscription if any
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
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
          onBookingUpdate(payload.new, undefined, payload.new.status);
        }
      )
      .subscribe((status) => {
        console.log(`Customer bookings subscription status for ${customerId}:`, status);
      });

    this.channels.set(channelName, channel);

    return () => {
      const ch = this.channels.get(channelName);
      if (ch) {
        client.removeChannel(ch);
        this.channels.delete(channelName);
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

    // Remove existing subscription if any
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
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
          onBookingUpdate(payload.new, undefined, payload.new.status);
        }
      )
      .subscribe((status) => {
        console.log(`Provider bookings subscription status for ${providerId}:`, status);
      });

    this.channels.set(channelName, channel);

    return () => {
      const ch = this.channels.get(channelName);
      if (ch) {
        client.removeChannel(ch);
        this.channels.delete(channelName);
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
  }
}