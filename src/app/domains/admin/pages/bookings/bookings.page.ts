import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonList, IonItem, IonLabel, IonBadge,
  IonSegment, IonSegmentButton,
  IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent,
  IonIcon, IonRefresher, IonRefresherContent, IonChip,
  IonButtons, IonBackButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, cashOutline } from 'ionicons/icons';
import { AdminService, AdminBooking } from '../../../../core/services/admin.service';
import { devError } from '../../../../core/utils/logger';

@Component({
  selector: 'app-bookings',
  templateUrl: './bookings.page.html',
  styleUrls: ['./bookings.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonList, IonItem, IonLabel, IonBadge,
    IonSegment, IonSegmentButton,
    IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent,
    IonIcon, IonRefresher, IonRefresherContent, IonChip,
    IonButtons, IonBackButton,
    CommonModule
  ]
})
export class BookingsPage implements OnInit {
  private adminService = inject(AdminService);

  bookings = signal<AdminBooking[]>([]);
  loading = signal(true);
  totalCount = signal(0);
  currentPage = signal(1);
  statusFilter = signal<string>('');

  private pageSize = 20;

  constructor() {
    addIcons({ calendarOutline, cashOutline });
  }

  async ngOnInit() {
    await this.loadBookings();
  }

  async loadBookings(append = false) {
    if (!append) {
      this.loading.set(true);
      this.currentPage.set(1);
    }
    try {
      const result = await this.adminService.getBookings(
        this.currentPage(),
        this.pageSize,
        this.statusFilter() || undefined
      );
      if (append) {
        this.bookings.update(existing => [...existing, ...result.data]);
      } else {
        this.bookings.set(result.data);
      }
      this.totalCount.set(result.count);
    } catch (err) {
      devError('Failed to load bookings:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async onStatusChange(event: any) {
    this.statusFilter.set(event.detail.value || '');
    await this.loadBookings();
  }

  async loadMore(event: any) {
    this.currentPage.update(p => p + 1);
    await this.loadBookings(true);
    event.target.complete();
    if (this.bookings().length >= this.totalCount()) {
      event.target.disabled = true;
    }
  }

  async handleRefresh(event: any) {
    await this.loadBookings();
    event.target.complete();
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      paid: 'success', confirmed: 'primary', in_progress: 'secondary',
      on_the_way: 'tertiary', arrived: 'tertiary', cancelled: 'danger',
      rejected: 'danger', expired: 'warning', finding_provider: 'medium',
      pending_acceptance: 'warning', payment_pending: 'warning',
    };
    return colors[status] || 'medium';
  }

  formatCurrency(amount: number): string {
    return this.adminService.formatCurrency(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
