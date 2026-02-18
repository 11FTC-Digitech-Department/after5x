import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { SessionService } from '../auth/session';
import { RealTimeService } from './real-time.service';
import { NotificationChannel, NotificationType, NotificationPayload } from '../models/booking.model';
import { devLog, devError } from '../utils/logger';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private realTimeService = inject(RealTimeService);

  /** Single source of truth for unread notification count (used by tabs and home header). */
  private _unreadCount = signal(0);
  readonly unreadCount = this._unreadCount.asReadonly();

  // Toast deduplication - track recent toasts to prevent duplicates
  private recentToasts = new Map<string, number>();
  private readonly DEDUP_WINDOW_MS = 5000; // 5 second deduplication window

  /**
   * Check if a toast should be shown (deduplication)
   * Returns true if toast should be shown, false if it's a duplicate
   */
  shouldShowToast(notificationId: string): boolean {
    this.cleanupOldToasts();

    const lastShown = this.recentToasts.get(notificationId);
    const now = Date.now();

    if (lastShown && (now - lastShown) < this.DEDUP_WINDOW_MS) {
      // Duplicate within dedup window - skip
      return false;
    }

    // Add/update entry and allow toast
    this.recentToasts.set(notificationId, now);
    return true;
  }

  /**
   * Clean up toast entries older than the deduplication window
   */
  private cleanupOldToasts(): void {
    const now = Date.now();
    for (const [id, timestamp] of this.recentToasts.entries()) {
      if (now - timestamp > this.DEDUP_WINDOW_MS) {
        this.recentToasts.delete(id);
      }
    }
  }

  async notifyBookingEvent(
    bookingId: string,
    type: NotificationType,
    recipients: string[],
    data: any = {}
  ): Promise<void> {
    try {
      // Determine notification channels and content based on type
      const notifications = this.buildNotifications(bookingId, type, data);

      // Send notifications in parallel
      const notificationPromises = notifications.map(notification =>
        this.sendNotification(notification, recipients)
      );
      await Promise.all(notificationPromises.map(p => p.catch(e => devError('Notification failed:', e))));

    // Log notification events
    await this.logNotificationEvents(bookingId, type, recipients);

    } catch (error) {
      devError('Notification failed:', error);
      // Don't throw - notifications shouldn't break the booking flow
    }
  }

  async notifyProviderAssignment(
    bookingId: string,
    providerId: string,
    bookingData: any
  ): Promise<void> {
    await this.notifyBookingEvent(bookingId, NotificationType.PROVIDER_ASSIGNED, [providerId], {
      providerId,
      bookingData
    });
  }

  async notifyCustomerStatusUpdate(
    bookingId: string,
    customerId: string,
    status: string,
    additionalData?: any
  ): Promise<void> {
    const notificationType = this.mapStatusToNotificationType(status);
    if (notificationType) {
      await this.notifyBookingEvent(bookingId, notificationType, [customerId], {
        status,
        ...additionalData
      });
    }
  }

  private buildNotifications(bookingId: string, type: NotificationType, data: any): NotificationPayload[] {
    const notifications: NotificationPayload[] = [];

    switch (type) {
      case NotificationType.BOOKING_CREATED:
        notifications.push({
          type,
          bookingId,
          title: 'Booking Submitted',
          message: 'Your service request has been received and is being processed.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP]
        });
        break;

      case NotificationType.PROVIDER_ASSIGNED:
        notifications.push({
          type,
          bookingId,
          title: 'Provider Assigned',
          message: 'A service provider has been assigned to your booking.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.IN_APP]
        });
        break;

      case NotificationType.BOOKING_CONFIRMED:
        notifications.push({
          type,
          bookingId,
          title: 'Booking Confirmed',
          message: data?.providerName
            ? `${data.providerName} has confirmed your ${data.serviceName || 'service'} booking.`
            : 'Your booking has been confirmed by the provider.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.IN_APP]
        });
        break;

      case NotificationType.PROVIDER_EN_ROUTE:
        notifications.push({
          type,
          bookingId,
          title: 'Provider En Route',
          message: data?.providerName
            ? `${data.providerName} is on the way to your location.`
            : 'Your service provider is on the way to your location.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS]
        });
        break;

      case NotificationType.PROVIDER_ARRIVED:
        notifications.push({
          type,
          bookingId,
          title: 'Provider Arrived',
          message: data?.providerName
            ? `${data.providerName} has arrived at your location.`
            : 'Your service provider has arrived at your location.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS]
        });
        break;

      case NotificationType.BOOKING_COMPLETED:
        notifications.push({
          type,
          bookingId,
          title: 'Service Completed',
          message: data?.serviceName
            ? `Your ${data.serviceName} service has been completed successfully.`
            : 'Your service has been completed successfully.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL, NotificationChannel.IN_APP]
        });
        break;

      case NotificationType.BOOKING_CANCELLED:
        notifications.push({
          type,
          bookingId,
          title: 'Booking Cancelled',
          message: data?.serviceName
            ? `Your ${data.serviceName} booking has been cancelled.`
            : 'Your booking has been cancelled.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.IN_APP]
        });
        break;

      case NotificationType.BOOKING_REJECTED:
        notifications.push({
          type,
          bookingId,
          title: 'Booking Rejected',
          message: data?.providerName
            ? `${data.providerName} was unable to accept your ${data.serviceName || 'service'} booking.`
            : 'Your booking has been rejected by the provider.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.IN_APP]
        });
        break;

      default:
        devError('Unknown notification type:', type);
        // Create a fallback notification to prevent null type errors
        notifications.push({
          type: NotificationType.BOOKING_CREATED, // Fallback type
          bookingId,
          title: 'Notification',
          message: 'You have a new notification.',
          data,
          channels: [NotificationChannel.IN_APP]
        });
        break;
    }

    return notifications;
  }

  private async sendNotification(notification: NotificationPayload, recipients: string[]): Promise<void> {
    const client = this.supabaseService.client;

    // Send to each channel
    for (const channel of notification.channels) {
      try {
        switch (channel) {
          case NotificationChannel.PUSH:
            await this.sendPushNotification(recipients, notification);
            break;
          case NotificationChannel.SMS:
            await this.sendSMSNotification(recipients, notification);
            break;
          case NotificationChannel.EMAIL:
            await this.sendEmailNotification(recipients, notification);
            break;
          case NotificationChannel.IN_APP:
            await this.sendInAppNotification(recipients, notification);
            break;
        }
      } catch (error) {
        devError(`Failed to send ${channel} notification:`, error);
      }
    }
  }

  private async sendPushNotification(recipients: string[], notification: NotificationPayload): Promise<void> {
    // For now, log the push notification
    // In production, integrate with FCM, OneSignal, or similar service
    devLog('Sending push notification:', {
      recipients,
      title: notification.title,
      message: notification.message,
      data: notification.data
    });

    // Create in-app notification record for push notifications
    await this.sendInAppNotification(recipients, notification);
  }

  private async sendSMSNotification(recipients: string[], notification: NotificationPayload): Promise<void> {
    const client = this.supabaseService.client;

    // Get phone numbers for recipients
    const { data: profiles, error } = await client
      .from('profiles')
      .select('phone_number')
      .in('id', recipients)
      .not('phone_number', 'is', null);

    if (error || !profiles) {
      devError('Failed to get phone numbers:', error);
      return;
    }

    // For now, log SMS notifications
    // In production, integrate with Twilio, AWS SNS, or similar service
    devLog('Sending SMS notifications:', {
      phoneNumbers: profiles.map(p => p.phone_number),
      message: notification.message
    });
  }

  private async sendEmailNotification(recipients: string[], notification: NotificationPayload): Promise<void> {
    const client = this.supabaseService.client;

    // Get email addresses for recipients
    const { data: profiles, error } = await client
      .from('profiles')
      .select('id') // Assuming email is the ID or we need to add email field
      .in('id', recipients);

    if (error || !profiles) {
      devError('Failed to get email addresses:', error);
      return;
    }

    // For now, log email notifications
    // In production, integrate with SendGrid, AWS SES, or similar service
    devLog('Sending email notifications:', {
      recipients,
      subject: notification.title,
      message: notification.message,
      html: this.generateEmailHTML(notification)
    });
  }

  private   async sendInAppNotification(recipients: string[], notification: NotificationPayload): Promise<void> {
    const client = this.supabaseService.client;

    // Create notification records in database (matching existing schema)
    const notificationRecords = recipients.map(recipientId => ({
      user_id: recipientId,
      type: notification.type,
      title: notification.title,
      body: notification.message, // Use 'body' to match existing schema
      message: notification.message, // Also set message for new column
      data: notification.data,
      read: false,
      created_at: new Date().toISOString()
    }));

    const { error } = await client
      .from('notifications')
      .insert(notificationRecords);

    if (error) {
      devError('Failed to create in-app notifications:', error);
    }
  }

  private async logNotificationEvents(
    bookingId: string,
    type: NotificationType,
    recipients: string[]
  ): Promise<void> {
    const client = this.supabaseService.client;

    const logRecords = recipients.map(recipientId => ({
      booking_id: bookingId,
      notification_type: type as any,
      recipient_id: recipientId,
      channel: 'in_app', // Default channel
      sent_at: new Date().toISOString()
    }));

    const { error } = await client
      .from('notification_logs')
      .insert(logRecords);

    if (error) {
      devError('Failed to log notification events:', error);
    }
  }

  private mapStatusToNotificationType(status: string): NotificationType | null {
    const statusMap: Record<string, NotificationType> = {
      'confirmed': NotificationType.BOOKING_CONFIRMED,
      'on_the_way': NotificationType.PROVIDER_EN_ROUTE,
      'arrived': NotificationType.PROVIDER_ARRIVED,
      'completed': NotificationType.BOOKING_COMPLETED,
      'cancelled': NotificationType.BOOKING_CANCELLED
    };

    return statusMap[status] || null;
  }

  private generateEmailHTML(notification: NotificationPayload): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${notification.title}</h2>
        <p>${notification.message}</p>
        ${notification.data && (notification.data as any).bookingId ?
          `<p><strong>Booking ID:</strong> ${(notification.data as any).bookingId}</p>` : ''
        }
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message from After5 Services.
        </p>
      </div>
    `;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const client = this.supabaseService.client;
    const user = this.sessionService.profile();

    if (!user) return;

    const { error } = await client
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) {
      devError('Failed to mark notification as read:', error);
    }
  }

  async getUserNotifications(limit = 20): Promise<any[]> {
    const client = this.supabaseService.client;
    const user = this.sessionService.profile();

    if (!user) return [];

    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      devError('Failed to get user notifications:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Refresh unread count from API. Call on init and when notifications list is viewed.
   */
  async refreshUnreadCount(): Promise<void> {
    const notifications = await this.getUserNotifications(50);
    const count = notifications.filter((n: { read?: boolean }) => !n.read).length;
    this._unreadCount.set(count);
  }

  /**
   * Subscribe to real-time notification inserts and refresh unread count.
   * Optional callback is called for each new notification (e.g. to show toast).
   * Returns unsubscribe function.
   */
  subscribeToUnreadUpdates(userId: string, onNotification?: (notification: { id?: string; title?: string; type?: string }) => void): () => void {
    return this.realTimeService.subscribeToNotifications(userId, (notification) => {
      this.refreshUnreadCount();
      onNotification?.(notification);
    });
  }
}