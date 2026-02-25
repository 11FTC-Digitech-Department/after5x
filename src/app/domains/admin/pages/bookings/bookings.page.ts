import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonNote,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForwardOutline } from 'ionicons/icons';
import { AdminService, AdminBooking } from '../../../../core/services/admin.service';

@Component({
  selector: 'app-bookings',
  templateUrl: './bookings.page.html',
  styleUrls: ['./bookings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    IonBadge,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonNote,
  ],
})
export class BookingsPage implements OnInit {
  private adminService = inject(AdminService);
  private toastCtrl = inject(ToastController);

  bookings = signal<AdminBooking[]>([]);
  isLoading = signal(false);
  statusFilter = signal('');
  page = 0;
  hasMore = true;

  constructor() {
    addIcons({ chevronForwardOutline });
  }

  ngOnInit() {
    this.loadBookings(true);
  }

  async loadBookings(reset = false) {
    if (reset) {
      this.page = 0;
      this.hasMore = true;
      this.bookings.set([]);
    }
    if (!this.hasMore) return;

    this.isLoading.set(true);
    try {
      const result = await this.adminService.getBookings({
        page: this.page,
        pageSize: 20,
        status: this.statusFilter() || undefined,
      });
      if (result.length < 20) this.hasMore = false;
      this.bookings.update((prev) => [...prev, ...result]);
      this.page++;
    } catch (e: any) {
      const toast = await this.toastCtrl.create({
        message: e.message || 'Failed to load bookings',
        color: 'danger',
        duration: 2000,
      });
      await toast.present();
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: any) {
    await this.loadBookings(true);
    event.target.complete();
  }

  async onInfiniteScroll(event: any) {
    await this.loadBookings();
    event.target.complete();
  }

  onStatusFilter(ev: any) {
    this.statusFilter.set(ev.detail.value || '');
    this.loadBookings(true);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'success';
      case 'cancelled':
      case 'rejected':
      case 'expired': return 'danger';
      case 'in_progress':
      case 'on_the_way':
      case 'arrived': return 'primary';
      case 'confirmed': return 'secondary';
      case 'pending_acceptance':
      case 'finding_provider': return 'warning';
      case 'paid':
      case 'payment_pending': return 'tertiary';
      default: return 'medium';
    }
  }
}
