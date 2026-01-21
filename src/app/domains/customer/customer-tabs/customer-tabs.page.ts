import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  calendarOutline,
  gridOutline,
  chatbubblesOutline,
  personOutline
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { NotificationService } from '@core/services/notification.service';
import { RealTimeService } from '@core/services/real-time.service';

@Component({
  selector: 'app-customer-tabs',
  templateUrl: './customer-tabs.page.html',
  styleUrls: ['./customer-tabs.page.scss'],
  standalone: true,
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonBadge,
    CommonModule,
    FormsModule
  ]
})
export class CustomerTabsPage implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private notificationService = inject(NotificationService);
  private realTimeService = inject(RealTimeService);
  private toastController = inject(ToastController);

  unreadNotificationCount = signal(0);

  private unsubscribeRealTime: (() => void) | null = null;
  private userId: string | null = null;

  constructor() {
    addIcons({
      homeOutline,
      calendarOutline,
      gridOutline,
      chatbubblesOutline,
      personOutline
    });

    // Reactive effect to load notifications when profile becomes available
    effect(() => {
      const profile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      if (profile?.id && !isLoading && !this.userId) {
        this.userId = profile.id;
        this.loadUnreadCount();
        this.setupRealTimeSubscription();
      }
    });
  }

  async ngOnInit() {
    const profile = this.sessionService.profile();
    if (profile?.id && !this.userId) {
      this.userId = profile.id;
      await this.loadUnreadCount();
      this.setupRealTimeSubscription();
    }
  }

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
  }

  async loadUnreadCount() {
    try {
      const notifications = await this.notificationService.getUserNotifications(50);
      const unreadCount = notifications.filter((n: any) => !n.read).length;
      this.unreadNotificationCount.set(unreadCount);
    } catch (error) {
      console.error('Failed to load notification count:', error);
    }
  }

  private setupRealTimeSubscription() {
    if (!this.userId) return;

    this.unsubscribeRealTime = this.realTimeService.subscribeToNotifications(
      this.userId,
      async (notification: any) => {
        // Increment badge count
        this.unreadNotificationCount.update(count => count + 1);

        // Show toast with deduplication check
        if (notification.id && this.notificationService.shouldShowToast(notification.id)) {
          await this.showToast(notification.title || 'New notification', notification.type);
        }
      }
    );
  }

  private async showToast(message: string, type?: string) {
    // Determine color based on notification type
    let color = 'primary';
    if (type) {
      if (type.includes('completed') || type.includes('confirmed')) {
        color = 'success';
      } else if (type.includes('cancelled') || type.includes('rejected')) {
        color = 'danger';
      } else if (type.includes('en_route') || type.includes('arrived')) {
        color = 'tertiary';
      }
    }

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
