import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { devError } from '../../../core/utils/logger';
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
  personOutline,
  notificationsOutline
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { NotificationService } from '@core/services/notification.service';
import { ChatService } from '@core/services/chat.service';
import { PromotionStoryService } from '@core/services/promotion-story.service';
import { PromotionStoryModalComponent } from '@shared/components/promotion-story-modal/promotion-story-modal.component';

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
    FormsModule,
    PromotionStoryModalComponent,
  ],
})
export class CustomerTabsPage implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private notificationService = inject(NotificationService);
  private chatService = inject(ChatService);
  private toastController = inject(ToastController);
  private promotionStoryService = inject(PromotionStoryService);

  /** Unread count from NotificationService (single source of truth). */
  unreadCount = this.notificationService.unreadCount;
  unreadChatCount = signal(0);

  private unsubscribeRealTime: (() => void) | null = null;
  private unsubscribeChatUpdates: (() => void) | null = null;
  private userId: string | null = null;

  constructor() {
    addIcons({
      homeOutline,
      calendarOutline,
      gridOutline,
      chatbubblesOutline,
      personOutline,
      notificationsOutline
    });

    // Reactive effect to load and subscribe when profile becomes available
    effect(() => {
      const profile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      if (profile?.id && !isLoading && !this.userId) {
        this.userId = profile.id;
        this.notificationService.refreshUnreadCount();
        this.loadUnreadChatCount();
        this.setupRealTimeSubscription();
        if (profile.role === 'customer') {
          this.promotionStoryService.tryShowModal();
        }
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
      if (profile.role === 'customer') {
        await this.promotionStoryService.tryShowModal();
      }
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

  private setupRealTimeSubscription() {
    if (!this.userId) return;

    this.unsubscribeRealTime = this.notificationService.subscribeToUnreadUpdates(
      this.userId,
      async (notification) => {
        // Skip toast for booking_created - booking-form shows its own toast after creation
        if (notification.type === 'booking_created') return;
        if (notification.id && this.notificationService.shouldShowToast(notification.id)) {
          await this.showToast(notification.title || 'New notification', notification.type);
        }
      }
    );

    // Subscribe to real-time chat updates for badge
    this.unsubscribeChatUpdates = this.chatService.subscribeToConversationUpdates(
      (_bookingId, message) => {
        // Only increment for messages from other users
        if (message.sender_id !== this.userId) {
          this.unreadChatCount.update(count => count + 1);
        }
      }
    );
  }

  private async loadUnreadChatCount() {
    try {
      const count = await this.chatService.refreshTotalUnreadCount();
      this.unreadChatCount.set(count);
    } catch (error) {
      devError('Failed to load chat count:', error);
    }
  }

  private async showToast(message: string, type?: string) {
    // Determine color based on notification type
    let color = 'primary';
    if (type) {
      if (type.includes('created')) {
        color = 'warning';
      } else if (type.includes('completed') || type.includes('confirmed')) {
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
