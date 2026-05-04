import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonList, IonItem, IonLabel, IonAvatar, IonBadge,
  IonSegment, IonSegmentButton,
  IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent,
  IonIcon, IonButton, IonRefresher, IonRefresherContent,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline, starOutline, checkmarkCircleOutline, closeCircleOutline
} from 'ionicons/icons';
import { AdminService, AdminProvider } from '../../../../core/services/admin.service';
import { devError } from '../../../../core/utils/logger';

@Component({
  selector: 'app-providers',
  templateUrl: './providers.page.html',
  styleUrls: ['./providers.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonList, IonItem, IonLabel, IonAvatar, IonBadge,
    IonSegment, IonSegmentButton,
    IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent,
    IonIcon, IonButton, IonRefresher, IonRefresherContent,
    CommonModule
  ]
})
export class ProvidersPage implements OnInit {
  private adminService = inject(AdminService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);

  providers = signal<AdminProvider[]>([]);
  loading = signal(true);
  totalCount = signal(0);
  currentPage = signal(1);
  statusFilter = signal<string>('');

  private pageSize = 20;

  constructor() {
    addIcons({ personOutline, starOutline, checkmarkCircleOutline, closeCircleOutline });
  }

  async ngOnInit() {
    await this.loadProviders();
  }

  async loadProviders(append = false) {
    if (!append) {
      this.loading.set(true);
      this.currentPage.set(1);
    }
    try {
      const result = await this.adminService.getProviders(
        this.currentPage(),
        this.pageSize,
        this.statusFilter() || undefined
      );
      if (append) {
        this.providers.update(existing => [...existing, ...result.data]);
      } else {
        this.providers.set(result.data);
      }
      this.totalCount.set(result.count);
    } catch (err) {
      devError('Failed to load providers:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async onStatusChange(event: any) {
    this.statusFilter.set(event.detail.value || '');
    await this.loadProviders();
  }

  async loadMore(event: any) {
    this.currentPage.update(p => p + 1);
    await this.loadProviders(true);
    event.target.complete();
    if (this.providers().length >= this.totalCount()) {
      event.target.disabled = true;
    }
  }

  async handleRefresh(event: any) {
    await this.loadProviders();
    event.target.complete();
  }

  async updateVerification(provider: AdminProvider, newStatus: string) {
    const alert = await this.alertController.create({
      header: 'Confirm Action',
      message: `Set verification to "${newStatus}" for ${provider.profile?.full_name || 'this provider'}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: async () => {
            try {
              await this.adminService.updateProviderVerification(provider.id, newStatus);
              const toast = await this.toastController.create({
                message: 'Provider verification updated',
                duration: 2000,
                color: 'success'
              });
              await toast.present();
              await this.loadProviders();
            } catch (err) {
              devError('Failed to update verification:', err);
              const toast = await this.toastController.create({
                message: 'Failed to update verification',
                duration: 3000,
                color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  getVerificationColor(status: string): string {
    const colors: Record<string, string> = {
      verified: 'success', pending: 'warning', rejected: 'danger', suspended: 'danger',
    };
    return colors[status] || 'medium';
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      online: 'success', offline: 'medium', busy: 'warning', suspended: 'danger',
    };
    return colors[status] || 'medium';
  }

  isClosed(provider: AdminProvider): boolean {
    return provider.profile?.account_status === 'closed' || !!provider.profile?.closed_at;
  }

  getInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  }
}
