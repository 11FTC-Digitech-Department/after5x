import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  RefresherCustomEvent,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  notificationsOutline,
  briefcaseOutline,
  walletOutline,
  settingsOutline,
  checkmarkDoneOutline,
  chevronForward,
  ellipseOutline,
  ellipse,
  timeOutline
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { NotificationService } from '@core/services/notification.service';
import { RealTimeService } from '@core/services/real-time.service';
import { NotificationType } from '@core/models/booking.model';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  message?: string;
  data?: any;
  read: boolean;
  read_at?: string;
  created_at: string;
}

type FilterType = 'all' | 'jobs' | 'payments' | 'system';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonButton
  ]
})
export class NotificationsPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private notificationService = inject(NotificationService);
  private realTimeService = inject(RealTimeService);
  private toastController = inject(ToastController);

  // State
  notifications = signal<Notification[]>([]);
  isLoading = signal(true);
  selectedFilter = signal<FilterType>('all');

  // Real-time subscription
  private unsubscribeRealTime: (() => void) | null = null;
  private userId: string | null = null;

  // Computed
  filteredNotifications = computed(() => {
    const all = this.notifications();
    const filter = this.selectedFilter();

    if (filter === 'all') return all;

    return all.filter(n => {
      switch (filter) {
        case 'jobs':
          return this.isJobNotification(n.type);
        case 'payments':
          return this.isPaymentNotification(n.type);
        case 'system':
          return this.isSystemNotification(n.type);
        default:
          return true;
      }
    });
  });

  unreadCount = computed(() =>
    this.notifications().filter(n => !n.read).length
  );

  hasUnread = computed(() => this.unreadCount() > 0);

  constructor() {
    addIcons({
      notificationsOutline,
      briefcaseOutline,
      walletOutline,
      settingsOutline,
      checkmarkDoneOutline,
      chevronForward,
      ellipseOutline,
      ellipse,
      timeOutline
    });
  }

  async ngOnInit() {
    const profile = this.sessionService.profile();
    if (profile?.id) {
      this.userId = profile.id;
      await this.loadNotifications();
      this.setupRealTimeSubscription();
    }
  }

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
  }

  async loadNotifications() {
    this.isLoading.set(true);

    try {
      const notifications = await this.notificationService.getUserNotifications(100);
      this.notifications.set(notifications as Notification[]);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      await this.showToast('Failed to load notifications', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  private setupRealTimeSubscription() {
    if (!this.userId) return;

    this.unsubscribeRealTime = this.realTimeService.subscribeToNotifications(
      this.userId,
      (notification) => {
        // Add new notification to the top of the list
        this.notifications.update(list => [notification as Notification, ...list]);
      }
    );
  }

  async handleRefresh(event: RefresherCustomEvent) {
    await this.loadNotifications();
    event.target.complete();
  }

  onFilterChange(event: CustomEvent) {
    this.selectedFilter.set(event.detail.value as FilterType);
  }

  async onNotificationClick(notification: Notification) {
    // Mark as read if not already
    if (!notification.read) {
      await this.markAsRead(notification);
    }

    // Navigate to relevant page based on notification data
    if (notification.data?.bookingId) {
      this.router.navigate(['/c/bookings', notification.data.bookingId]);
    }
  }

  async markAsRead(notification: Notification) {
    try {
      await this.notificationService.markNotificationAsRead(notification.id);

      // Update local state
      this.notifications.update(list =>
        list.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async markAllAsRead() {
    const unreadNotifications = this.notifications().filter(n => !n.read);

    try {
      // Mark all unread as read
      await Promise.all(
        unreadNotifications.map(n =>
          this.notificationService.markNotificationAsRead(n.id)
        )
      );

      // Update local state
      this.notifications.update(list =>
        list.map(n => ({ ...n, read: true }))
      );

      await this.showToast('All notifications marked as read', 'success');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      await this.showToast('Failed to mark notifications as read', 'danger');
    }
  }

  // Helper methods
  getNotificationIcon(type: string): string {
    if (this.isJobNotification(type)) return 'briefcase-outline';
    if (this.isPaymentNotification(type)) return 'wallet-outline';
    return 'notifications-outline';
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case NotificationType.BOOKING_CREATED:
      case NotificationType.PROVIDER_ASSIGNED:
        return 'primary';
      case NotificationType.BOOKING_CONFIRMED:
        return 'success';
      case NotificationType.PROVIDER_EN_ROUTE:
      case NotificationType.PROVIDER_ARRIVED:
        return 'tertiary';
      case NotificationType.BOOKING_COMPLETED:
        return 'success';
      case NotificationType.BOOKING_CANCELLED:
      case NotificationType.BOOKING_REJECTED:
        return 'danger';
      default:
        return 'medium';
    }
  }

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  private isJobNotification(type: string): boolean {
    const jobTypes = [
      NotificationType.BOOKING_CREATED,
      NotificationType.PROVIDER_ASSIGNED,
      NotificationType.BOOKING_CONFIRMED,
      NotificationType.PROVIDER_EN_ROUTE,
      NotificationType.PROVIDER_ARRIVED,
      NotificationType.BOOKING_COMPLETED,
      NotificationType.BOOKING_CANCELLED,
      NotificationType.BOOKING_REJECTED
    ];
    return jobTypes.includes(type as NotificationType);
  }

  private isPaymentNotification(type: string): boolean {
    // Add payment notification types when available
    return type.includes('payment') || type.includes('payout');
  }

  private isSystemNotification(type: string): boolean {
    return !this.isJobNotification(type) && !this.isPaymentNotification(type);
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      buttons: [{ icon: 'close', role: 'cancel' }]
    });
    await toast.present();
  }
}
