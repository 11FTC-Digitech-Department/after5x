import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  statsChart,
  calendar,
  wallet,
  person
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { NotificationService } from '@core/services/notification.service';
import { RealTimeService } from '@core/services/real-time.service';

@Component({
  selector: 'app-provider-tabs',
  templateUrl: './provider-tabs.page.html',
  styleUrls: ['./provider-tabs.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonBadge
  ]
})
export class ProviderTabsPage implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private notificationService = inject(NotificationService);
  private realTimeService = inject(RealTimeService);

  unreadNotificationCount = signal(0);

  private unsubscribeRealTime: (() => void) | null = null;
  private userId: string | null = null;

  constructor() {
    addIcons({
      statsChart,
      calendar,
      wallet,
      person
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
      () => {
        this.unreadNotificationCount.update(count => count + 1);
      }
    );
  }
}
