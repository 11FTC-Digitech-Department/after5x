import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonAvatar,
  IonBadge,
  IonButton,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  ActionSheetController,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { ellipsisHorizontalOutline, personOutline, starOutline } from 'ionicons/icons';
import { AdminService, AdminProvider } from '../../../../core/services/admin.service';

@Component({
  selector: 'app-providers',
  templateUrl: './providers.page.html',
  styleUrls: ['./providers.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    IonAvatar,
    IonBadge,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
})
export class ProvidersPage implements OnInit {
  private adminService = inject(AdminService);
  private actionSheetCtrl = inject(ActionSheetController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  providers = signal<AdminProvider[]>([]);
  isLoading = signal(false);
  searchQuery = signal('');
  statusFilter = signal('');
  page = 0;
  hasMore = true;

  constructor() {
    addIcons({ ellipsisHorizontalOutline, personOutline, starOutline });
  }

  ngOnInit() {
    this.loadProviders(true);
  }

  async loadProviders(reset = false) {
    if (reset) {
      this.page = 0;
      this.hasMore = true;
      this.providers.set([]);
    }
    if (!this.hasMore) return;

    this.isLoading.set(true);
    try {
      const filter = this.statusFilter();
      const result = await this.adminService.getProviders({
        page: this.page,
        pageSize: 20,
        search: this.searchQuery() || undefined,
        verificationStatus: filter && filter !== 'suspended' ? filter : undefined,
      });

      let filtered = result;
      if (filter === 'suspended') {
        filtered = result.filter((p) => p.status === 'suspended');
      }

      if (result.length < 20) this.hasMore = false;
      this.providers.update((prev) => [...prev, ...filtered]);
      this.page++;
    } catch (e: any) {
      await this.showToast(e.message || 'Failed to load providers', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: any) {
    await this.loadProviders(true);
    event.target.complete();
  }

  async onInfiniteScroll(event: any) {
    await this.loadProviders();
    event.target.complete();
  }

  onSearchChange(ev: any) {
    this.searchQuery.set(ev.detail.value || '');
    this.loadProviders(true);
  }

  onStatusFilter(ev: any) {
    this.statusFilter.set(ev.detail.value || '');
    this.loadProviders(true);
  }

  async openActions(provider: AdminProvider) {
    const buttons: any[] = [];

    if (provider.verification_status === 'pending') {
      buttons.push({
        text: 'Approve Provider',
        handler: () => this.confirmVerification(provider, 'verified'),
      });
      buttons.push({
        text: 'Reject Provider',
        role: 'destructive',
        handler: () => this.confirmVerification(provider, 'rejected'),
      });
    }

    if (provider.verification_status === 'verified' && provider.status !== 'suspended') {
      buttons.push({
        text: 'Suspend Provider',
        role: 'destructive',
        handler: () => this.confirmSuspend(provider),
      });
    }

    if (provider.status === 'suspended') {
      buttons.push({
        text: 'Reinstate Provider',
        handler: () => this.reinstateProvider(provider),
      });
    }

    const activated = provider.profile?.activated ?? true;
    buttons.push({
      text: activated ? 'Deactivate Account' : 'Activate Account',
      role: activated ? 'destructive' : undefined,
      handler: () => this.toggleActivation(provider, !activated),
    });

    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({
      header: provider.profile?.full_name || 'Provider',
      buttons,
    });
    await sheet.present();
  }

  async confirmVerification(provider: AdminProvider, status: 'verified' | 'rejected') {
    const alert = await this.alertCtrl.create({
      header: status === 'verified' ? 'Approve Provider?' : 'Reject Provider?',
      message: `Are you sure you want to ${status === 'verified' ? 'approve' : 'reject'} ${provider.profile?.full_name}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          role: status === 'rejected' ? 'destructive' : undefined,
          handler: async () => {
            try {
              await this.adminService.updateProviderVerification(provider.id, status);
              this.providers.update((list) =>
                list.map((p) => (p.id === provider.id ? { ...p, verification_status: status } : p))
              );
              await this.showToast(`Provider ${status}`);
            } catch (e: any) {
              await this.showToast(e.message || 'Failed', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmSuspend(provider: AdminProvider) {
    const alert = await this.alertCtrl.create({
      header: 'Suspend Provider?',
      message: `This will prevent ${provider.profile?.full_name} from taking bookings.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Suspend',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminService.setProviderStatus(provider.id, 'suspended');
              this.providers.update((list) =>
                list.map((p) => (p.id === provider.id ? { ...p, status: 'suspended' } : p))
              );
              await this.showToast('Provider suspended');
            } catch (e: any) {
              await this.showToast(e.message || 'Failed', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async reinstateProvider(provider: AdminProvider) {
    try {
      await this.adminService.setProviderStatus(provider.id, 'offline');
      this.providers.update((list) =>
        list.map((p) => (p.id === provider.id ? { ...p, status: 'offline' } : p))
      );
      await this.showToast('Provider reinstated');
    } catch (e: any) {
      await this.showToast(e.message || 'Failed', 'danger');
    }
  }

  async toggleActivation(provider: AdminProvider, activated: boolean) {
    try {
      await this.adminService.setProviderActivated(provider.id, activated);
      this.providers.update((list) =>
        list.map((p) =>
          p.id === provider.id
            ? { ...p, profile: p.profile ? { ...p.profile, activated } : p.profile }
            : p
        )
      );
      await this.showToast(activated ? 'Account activated' : 'Account deactivated');
    } catch (e: any) {
      await this.showToast(e.message || 'Failed', 'danger');
    }
  }

  getVerificationColor(status: string): string {
    switch (status) {
      case 'verified': return 'success';
      case 'rejected': return 'danger';
      default: return 'warning';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'online': return 'success';
      case 'busy': return 'warning';
      case 'suspended': return 'danger';
      default: return 'medium';
    }
  }

  private async showToast(message: string, color = 'success') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    await toast.present();
  }
}
