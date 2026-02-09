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
  personOutline,
  notificationsOutline
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { NotificationService } from '@core/services/notification.service';

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
  private toastController = inject(ToastController);

  /** Unread count from NotificationService (single source of truth). */
  unreadCount = this.notificationService.unreadCount;

  private unsubscribeRealTime: (() => void) | null = null;
  private userId: string | null = null;

  constructor() {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'customer-tabs.page.ts:constructor',message:'CustomerTabsPage constructed',data:{},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'customer-tabs.page.ts:effect',message:'effect run',data:{hasProfile:!!profile,profileId:profile?.id,isLoading,userId:this.userId},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (profile?.id && !isLoading && !this.userId) {
        this.userId = profile.id;
        try {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'customer-tabs.page.ts:beforeRefresh',message:'before refreshUnreadCount',data:{},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          this.notificationService.refreshUnreadCount();
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'customer-tabs.page.ts:afterRefresh',message:'after refreshUnreadCount',data:{},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          this.setupRealTimeSubscription();
        } catch (e) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'customer-tabs.page.ts:effectCatch',message:'effect threw',data:{err:String(e)},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          throw e;
        }
      }
    });
  }

  async ngOnInit() {
    const profile = this.sessionService.profile();
    if (profile?.id && !this.userId) {
      this.userId = profile.id;
      await this.notificationService.refreshUnreadCount();
      this.setupRealTimeSubscription();
    }
  }

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
  }

  private setupRealTimeSubscription() {
    if (!this.userId) return;

    this.unsubscribeRealTime = this.notificationService.subscribeToUnreadUpdates(
      this.userId,
      async (notification) => {
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
