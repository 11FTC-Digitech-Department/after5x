import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { devError } from '../../../core/utils/logger';
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
  receiptOutline,
  person,
  chatbubbles
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { NotificationService } from '@core/services/notification.service';
import { RealTimeService } from '@core/services/real-time.service';
import { ChatService } from '@core/services/chat.service';

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
  private chatService = inject(ChatService);

  unreadNotificationCount = this.notificationService.unreadCount;
  unreadChatCount = signal(0);

  private unsubscribeRealTime: (() => void) | null = null;
  private unsubscribeChatUpdates: (() => void) | null = null;
  private userId: string | null = null;

  constructor() {
    addIcons({
      statsChart,
      calendar,
      receiptOutline,
      person,
      chatbubbles
    });

    // Reactive effect to load notifications when profile becomes available
    effect(() => {
      const profile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      if (profile?.id && !isLoading && !this.userId) {
        this.userId = profile.id;
        this.notificationService.refreshUnreadCount();
        this.loadUnreadChatCount();
        this.setupRealTimeSubscription();
      }
    });
  }

  async ngOnInit() {
    const profile = this.sessionService.profile();
    if (profile?.id && !this.userId) {
      this.userId = profile.id;
      await this.notificationService.refreshUnreadCount();
      await this.loadUnreadChatCount();
      this.setupRealTimeSubscription();
    }
  }

  ionViewWillEnter() {
    if (this.userId) {
      this.notificationService.refreshUnreadCount();
    }
  }

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
    if (this.unsubscribeChatUpdates) {
      this.unsubscribeChatUpdates();
    }
  }

  async loadUnreadChatCount() {
    try {
      const count = await this.chatService.refreshTotalUnreadCount();
      this.unreadChatCount.set(count);
    } catch (error) {
      devError('Failed to load chat count:', error);
    }
  }

  private setupRealTimeSubscription() {
    if (!this.userId) return;

    this.unsubscribeRealTime = this.notificationService.subscribeToUnreadUpdates(
      this.userId,
      () => {}
    );

    // Subscribe to real-time chat updates for badge
    this.unsubscribeChatUpdates = this.chatService.subscribeToConversationUpdates(
      (_bookingId, message) => {
        if (message.sender_id !== this.userId) {
          this.unreadChatCount.update(count => count + 1);
        }
      }
    );
  }
}
