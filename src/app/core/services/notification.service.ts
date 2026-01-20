import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { SessionService } from '../auth/session';
import { NotificationChannel, NotificationType, NotificationPayload } from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);

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
      await Promise.all(notificationPromises.map(p => p.catch(e => console.error('Notification failed:', e))));

    // Log notification events
    await this.logNotificationEvents(bookingId, type, recipients);

    } catch (error) {
      console.error('Notification failed:', error);
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
          message: 'Your booking has been confirmed by the provider.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.IN_APP]
        });
        break;

      case NotificationType.PROVIDER_EN_ROUTE:
        notifications.push({
          type,
          bookingId,
          title: 'Provider En Route',
          message: 'Your service provider is on the way to your location.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS]
        });
        break;

      case NotificationType.PROVIDER_ARRIVED:
        notifications.push({
          type,
          bookingId,
          title: 'Provider Arrived',
          message: 'Your service provider has arrived at your location.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS]
        });
        break;

      case NotificationType.BOOKING_COMPLETED:
        notifications.push({
          type,
          bookingId,
          title: 'Service Completed',
          message: 'Your service has been completed successfully.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL, NotificationChannel.IN_APP]
        });
        break;

      case NotificationType.BOOKING_CANCELLED:
        notifications.push({
          type,
          bookingId,
          title: 'Booking Cancelled',
          message: 'Your booking has been cancelled.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.IN_APP]
        });
        break;

      case NotificationType.BOOKING_REJECTED:
        notifications.push({
          type,
          bookingId,
          title: 'Booking Rejected',
          message: 'Your booking has been rejected by the provider.',
          data,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.IN_APP]
        });
        break;

      default:
        console.error('Unknown notification type:', type);
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
        console.error(`Failed to send ${channel} notification:`, error);
      }
    }
  }

  private async sendPushNotification(recipients: string[], notification: NotificationPayload): Promise<void> {
    // For now, log the push notification
    // In production, integrate with FCM, OneSignal, or similar service
    console.log('Sending push notification:', {
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
      console.error('Failed to get phone numbers:', error);
      return;
    }

    // For now, log SMS notifications
    // In production, integrate with Twilio, AWS SNS, or similar service
    console.log('Sending SMS notifications:', {
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
      console.error('Failed to get email addresses:', error);
      return;
    }

    // For now, log email notifications
    // In production, integrate with SendGrid, AWS SES, or similar service
    console.log('Sending email notifications:', {
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
      console.error('Failed to create in-app notifications:', error);
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
      console.error('Failed to log notification events:', error);
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
      console.error('Failed to mark notification as read:', error);
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
      console.error('Failed to get user notifications:', error);
      return [];
    }

    return data || [];
  }
}