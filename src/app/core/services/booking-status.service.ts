import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { SessionService } from '../auth/session';
import { BookingStatus, BookingTimelineEntry, StatusTransition, InvalidStatusTransitionError, NotificationType } from '../models/booking.model';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class BookingStatusService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private notificationService = inject(NotificationService);

  // Define valid status transitions
  private readonly STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    [BookingStatus.FINDING_PROVIDER]: [BookingStatus.PENDING_ACCEPTANCE, BookingStatus.CANCELLED],
    [BookingStatus.PENDING_ACCEPTANCE]: [BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.CANCELLED],
    [BookingStatus.CONFIRMED]: [BookingStatus.ON_THE_WAY, BookingStatus.CANCELLED],
    [BookingStatus.ON_THE_WAY]: [BookingStatus.ARRIVED, BookingStatus.CANCELLED],
    [BookingStatus.ARRIVED]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
    [BookingStatus.IN_PROGRESS]: [BookingStatus.PAYMENT_PENDING, BookingStatus.CANCELLED],
    [BookingStatus.PAYMENT_PENDING]: [BookingStatus.PAID, BookingStatus.CANCELLED],
    [BookingStatus.PAID]: [BookingStatus.COMPLETED],
    [BookingStatus.COMPLETED]: [], // Terminal state
    [BookingStatus.CANCELLED]: [], // Terminal state
    [BookingStatus.REJECTED]: [], // Terminal state
    [BookingStatus.EXPIRED]: [] // Terminal state
  };

  // Statuses that should trigger notifications
  private readonly NOTIFICATION_TRIGGERS: Record<BookingStatus, boolean> = {
    [BookingStatus.FINDING_PROVIDER]: false,
    [BookingStatus.PENDING_ACCEPTANCE]: true,
    [BookingStatus.CONFIRMED]: true,
    [BookingStatus.ON_THE_WAY]: true,
    [BookingStatus.ARRIVED]: true,
    [BookingStatus.IN_PROGRESS]: false,
    [BookingStatus.PAYMENT_PENDING]: true,
    [BookingStatus.PAID]: false,
    [BookingStatus.COMPLETED]: true,
    [BookingStatus.CANCELLED]: true,
    [BookingStatus.REJECTED]: true,
    [BookingStatus.EXPIRED]: true
  };

  async updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    metadata?: any,
    performedBy?: string
  ): Promise<void> {
    const client = this.supabaseService.client;

    // Get current booking status
    const { data: booking, error: fetchError } = await client
      .from('bookings')
      .select('status, customer_id, provider_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Validate transition
    if (!this.isValidTransition(booking.status as BookingStatus, newStatus)) {
      throw new InvalidStatusTransitionError(booking.status as BookingStatus, newStatus);
    }

    // Update booking status
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Set status-specific timestamps
    switch (newStatus) {
      case BookingStatus.CONFIRMED:
        updateData.provider_assigned_at = new Date().toISOString();
        break;
      case BookingStatus.ON_THE_WAY:
        updateData.started_travel_at = new Date().toISOString();
        break;
      case BookingStatus.ARRIVED:
        updateData.arrived_at = new Date().toISOString();
        break;
      case BookingStatus.IN_PROGRESS:
        updateData.started_work_at = new Date().toISOString();
        break;
      case BookingStatus.COMPLETED:
        updateData.finished_work_at = new Date().toISOString();
        break;
    }

    const { error: updateError } = await client
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (updateError) {
      throw new Error(`Failed to update booking status: ${updateError.message}`);
    }

    // Create timeline entry
    await this.createTimelineEntry(bookingId, newStatus, metadata, performedBy);

    // Trigger notifications if needed
    if (this.NOTIFICATION_TRIGGERS[newStatus]) {
      await this.triggerStatusNotifications(bookingId, newStatus, booking.customer_id, booking.provider_id, metadata);
    }

    // Handle status-specific side effects
    await this.handleStatusSideEffects(bookingId, newStatus, metadata);
  }

  private isValidTransition(from: BookingStatus, to: BookingStatus): boolean {
    const allowedTransitions = this.STATUS_TRANSITIONS[from] || [];
    return allowedTransitions.includes(to);
  }

  async createTimelineEntry(
    bookingId: string,
    status: BookingStatus,
    metadata?: any,
    performedBy?: string
  ): Promise<void> {
    const client = this.supabaseService.client;
    const user = this.sessionService.profile();

    let title: string;
    let description: string;

    if (metadata?.title) {
      // Custom timeline entry
      title = metadata.title;
      description = metadata.description || '';
    } else {
      // Status-based timeline entry
      title = this.getStatusTitle(status);
      description = this.getStatusDescription(status, metadata);
    }

    // Use SECURITY DEFINER function to bypass RLS
    const { error } = await client.rpc('create_booking_timeline_entry', {
      p_booking_id: bookingId,
      p_title: title,
      p_description: description,
      p_icon_name: this.getStatusIcon(status)
    });

    if (error) {
      console.error('Failed to create timeline entry:', error);
    }
  }

  private getStatusTitle(status: BookingStatus): string {
    const titles: Record<BookingStatus, string> = {
      [BookingStatus.FINDING_PROVIDER]: 'Finding Provider',
      [BookingStatus.PENDING_ACCEPTANCE]: 'Provider Assigned',
      [BookingStatus.CONFIRMED]: 'Booking Confirmed',
      [BookingStatus.ON_THE_WAY]: 'Provider En Route',
      [BookingStatus.ARRIVED]: 'Provider Arrived',
      [BookingStatus.IN_PROGRESS]: 'Service In Progress',
      [BookingStatus.PAYMENT_PENDING]: 'Payment Required',
      [BookingStatus.PAID]: 'Payment Completed',
      [BookingStatus.COMPLETED]: 'Service Completed',
      [BookingStatus.CANCELLED]: 'Booking Cancelled',
      [BookingStatus.REJECTED]: 'Booking Rejected',
      [BookingStatus.EXPIRED]: 'Booking Expired'
    };

    return titles[status] || 'Status Updated';
  }

  private getStatusDescription(status: BookingStatus, metadata?: any): string {
    const descriptions: Record<BookingStatus, string> = {
      [BookingStatus.FINDING_PROVIDER]: 'Searching for an available service provider in your area.',
      [BookingStatus.PENDING_ACCEPTANCE]: 'A provider has been assigned and is reviewing your booking.',
      [BookingStatus.CONFIRMED]: 'Your booking has been confirmed and accepted by the provider.',
      [BookingStatus.ON_THE_WAY]: 'The service provider is on their way to your location.',
      [BookingStatus.ARRIVED]: 'The service provider has arrived at your location.',
      [BookingStatus.IN_PROGRESS]: 'The service work is now in progress.',
      [BookingStatus.PAYMENT_PENDING]: 'Service completed. Payment is required to finalize.',
      [BookingStatus.PAID]: 'Payment has been received successfully.',
      [BookingStatus.COMPLETED]: 'Your service has been completed successfully.',
      [BookingStatus.CANCELLED]: 'The booking has been cancelled.',
      [BookingStatus.REJECTED]: 'The booking was rejected by the provider.',
      [BookingStatus.EXPIRED]: 'The booking has expired due to no response.'
    };

    return descriptions[status] || 'Booking status has been updated.';
  }

  private getStatusIcon(status: BookingStatus): string {
    const icons: Record<BookingStatus, string> = {
      [BookingStatus.FINDING_PROVIDER]: 'search',
      [BookingStatus.PENDING_ACCEPTANCE]: 'person-add',
      [BookingStatus.CONFIRMED]: 'checkmark-circle',
      [BookingStatus.ON_THE_WAY]: 'car',
      [BookingStatus.ARRIVED]: 'location',
      [BookingStatus.IN_PROGRESS]: 'construct',
      [BookingStatus.PAYMENT_PENDING]: 'card',
      [BookingStatus.PAID]: 'cash',
      [BookingStatus.COMPLETED]: 'checkmark-done',
      [BookingStatus.CANCELLED]: 'close-circle',
      [BookingStatus.REJECTED]: 'remove-circle',
      [BookingStatus.EXPIRED]: 'time'
    };

    return icons[status] || 'information-circle';
  }

  private async triggerStatusNotifications(
    bookingId: string,
    status: BookingStatus,
    customerId: string,
    providerId: string | null,
    metadata?: any
  ): Promise<void> {
    try {
      // Notify customer
      await this.notificationService.notifyCustomerStatusUpdate(bookingId, customerId, status, metadata);

      // Notify provider if applicable
      if (providerId && this.shouldNotifyProvider(status)) {
        const notificationType = this.getProviderNotificationType(status);
        if (notificationType) {
          await this.notificationService.notifyBookingEvent(
            bookingId,
            notificationType,
            [providerId],
            { status, ...metadata }
          );
        }
      }
    } catch (error) {
      console.error('Failed to send status notifications:', error);
    }
  }

  private shouldNotifyProvider(status: BookingStatus): boolean {
    const providerNotifications: BookingStatus[] = [
      BookingStatus.CONFIRMED,
      BookingStatus.CANCELLED,
      BookingStatus.REJECTED
    ];
    return providerNotifications.includes(status);
  }

  private getProviderNotificationType(status: BookingStatus): NotificationType | null {
    const typeMap: Record<BookingStatus, NotificationType | null> = {
      [BookingStatus.FINDING_PROVIDER]: null,
      [BookingStatus.PENDING_ACCEPTANCE]: null,
      [BookingStatus.CONFIRMED]: NotificationType.BOOKING_CONFIRMED,
      [BookingStatus.ON_THE_WAY]: NotificationType.PROVIDER_EN_ROUTE,
      [BookingStatus.ARRIVED]: NotificationType.PROVIDER_ARRIVED,
      [BookingStatus.IN_PROGRESS]: null,
      [BookingStatus.PAYMENT_PENDING]: null,
      [BookingStatus.PAID]: null,
      [BookingStatus.COMPLETED]: NotificationType.BOOKING_COMPLETED,
      [BookingStatus.CANCELLED]: NotificationType.BOOKING_CANCELLED,
      [BookingStatus.REJECTED]: NotificationType.BOOKING_REJECTED,
      [BookingStatus.EXPIRED]: null
    };
    return typeMap[status] || null;
  }

  private async handleStatusSideEffects(
    bookingId: string,
    status: BookingStatus,
    metadata?: any
  ): Promise<void> {
    const client = this.supabaseService.client;

    switch (status) {
      case BookingStatus.COMPLETED:
        // Update provider statistics
        await this.updateProviderStats(bookingId);
        break;

      case BookingStatus.CANCELLED:
      case BookingStatus.REJECTED:
        // Free up provider if they were assigned
        await this.releaseProvider(bookingId);
        break;

      case BookingStatus.CONFIRMED:
        // Update provider status to busy
        await this.updateProviderAvailability(bookingId, 'busy');
        break;

      case BookingStatus.PAID:
        // Mark as completed automatically
        await this.updateBookingStatus(bookingId, BookingStatus.COMPLETED);
        break;
    }
  }

  private async updateProviderStats(bookingId: string): Promise<void> {
    const client = this.supabaseService.client;

    // Get booking and increment provider's completed bookings count
    const { data: booking, error } = await client
      .from('bookings')
      .select('provider_id')
      .eq('id', bookingId)
      .single();

    if (error || !booking?.provider_id) return;

    await client.rpc('increment_provider_bookings', {
      provider_id: booking.provider_id
    });
  }

  private async releaseProvider(bookingId: string): Promise<void> {
    await this.updateProviderAvailability(bookingId, 'online');
  }

  private async updateProviderAvailability(bookingId: string, status: 'online' | 'busy' | 'offline'): Promise<void> {
    const client = this.supabaseService.client;

    const { data: booking, error } = await client
      .from('bookings')
      .select('provider_id')
      .eq('id', bookingId)
      .single();

    if (error || !booking?.provider_id) return;

    const { error: updateError } = await client
      .from('providers')
      .update({ status: status })
      .eq('id', booking.provider_id);

    if (updateError) {
      console.error('Failed to update provider availability:', updateError);
    }
  }

  async getBookingTimeline(bookingId: string): Promise<BookingTimelineEntry[]> {
    const client = this.supabaseService.client;

    const { data, error } = await client
      .from('booking_timeline')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to get booking timeline:', error);
      return [];
    }

    return data?.map(entry => ({
      id: entry.id,
      bookingId: entry.booking_id,
      title: entry.title,
      description: entry.description || undefined,
      iconName: entry.icon_name || undefined,
      createdAt: entry.created_at ? new Date(entry.created_at) : new Date(),
      metadata: undefined // No metadata column in table
    })) || [];
  }

  async cancelBooking(bookingId: string, reason: string, cancelledBy: string): Promise<void> {
    const client = this.supabaseService.client;

    // Update booking with cancellation details
    const { error } = await client
      .from('bookings')
      .update({
        status: BookingStatus.CANCELLED,
        cancellation_reason: reason,
        cancelled_by: cancelledBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) {
      throw new Error(`Failed to cancel booking: ${error.message}`);
    }

    // Create timeline entry
    await this.createTimelineEntry(
      bookingId,
      BookingStatus.CANCELLED,
      { reason, cancelledBy },
      cancelledBy
    );

    // Trigger notifications
    await this.triggerStatusNotifications(bookingId, BookingStatus.CANCELLED, '', null, { reason });
  }
}