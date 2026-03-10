import { devError } from '../../../../core/utils/logger';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonSearchbar,
  IonChip,
  IonModal,
  IonDatetime,
  IonButtons,
  IonBackButton,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { receiptOutline, searchOutline, calendarOutline, filterOutline, closeCircle } from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { ProviderBookingService, ProviderBooking } from '@core/services/provider-booking.service';
import { WalletService } from '@core/services/wallet.service';
import { BookingStatus } from '@core/models/booking.model';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  [BookingStatus.FINDING_PROVIDER]: { label: 'Finding Provider', color: 'warning', icon: 'hourglass' },
  [BookingStatus.PENDING_ACCEPTANCE]: { label: 'Pending', color: 'warning', icon: 'hourglass' },
  [BookingStatus.CONFIRMED]: { label: 'Confirmed', color: 'primary', icon: 'checkmark-circle' },
  [BookingStatus.ON_THE_WAY]: { label: 'On The Way', color: 'tertiary', icon: 'car' },
  [BookingStatus.ARRIVED]: { label: 'Arrived', color: 'tertiary', icon: 'location-outline' },
  [BookingStatus.IN_PROGRESS]: { label: 'In Progress', color: 'secondary', icon: 'hammer' },
  [BookingStatus.PAYMENT_PENDING]: { label: 'Payment Due', color: 'warning', icon: 'alert-circle' },
  [BookingStatus.PAID]: { label: 'Paid', color: 'success', icon: 'checkmark-circle' },
  [BookingStatus.COMPLETED]: { label: 'Completed', color: 'success', icon: 'checkmark-circle' },
  [BookingStatus.CANCELLED]: { label: 'Cancelled', color: 'danger', icon: 'close-circle' },
  [BookingStatus.REJECTED]: { label: 'Rejected', color: 'danger', icon: 'close-circle' },
  [BookingStatus.EXPIRED]: { label: 'Expired', color: 'medium', icon: 'time-outline' }
};

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonBadge,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonSearchbar,
    IonChip,
    IonModal,
    IonDatetime,
    IonButtons,
    IonBackButton
  ]
})
export class TransactionsPage implements OnInit {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private providerBookingService = inject(ProviderBookingService);
  private walletService = inject(WalletService);

  bookings = signal<ProviderBooking[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);
  showDateFilter = signal(false);
  editingDateField = signal<'from' | 'to' | null>(null);
  pendingDateValue = signal<string | null>(null);

  completedStatuses = [BookingStatus.PAID, BookingStatus.COMPLETED];

  filteredBookings = computed(() => {
    const all = this.bookings();
    const q = this.searchQuery().trim().toLowerCase();
    const from = this.dateFrom();
    const to = this.dateTo();

    return all.filter(b => {
      if (q) {
        const shortId = this.getShortBookingId(b.id).toLowerCase();
        const fullId = b.id.toLowerCase();
        const serviceName = this.getServiceName(b).toLowerCase();
        const customerName = this.getCustomerName(b).toLowerCase();
        const matchesSearch =
          shortId.includes(q) ||
          fullId.includes(q) ||
          serviceName.includes(q) ||
          customerName.includes(q);
        if (!matchesSearch) return false;
      }

      if (from || to) {
        const refDate = b.scheduled_for || b.created_at;
        if (!refDate) return false;
        const d = new Date(refDate);
        d.setHours(0, 0, 0, 0);
        if (from) {
          const f = new Date(from);
          f.setHours(0, 0, 0, 0);
          if (d < f) return false;
        }
        if (to) {
          const t = new Date(to);
          t.setHours(23, 59, 59, 999);
          if (d > t) return false;
        }
      }
      return true;
    });
  });

  constructor() {
    addIcons({ receiptOutline, searchOutline, calendarOutline, filterOutline, closeCircle });
  }

  async ngOnInit() {
    await this.loadBookings();
  }

  async loadBookings() {
    this.isLoading.set(true);
    this.error.set(null);

    const profile = this.sessionService.profile();
    if (!profile?.id) {
      this.error.set('Please sign in to view transactions');
      this.isLoading.set(false);
      return;
    }

    try {
      const bookings = await this.providerBookingService.getProviderBookings(profile.id);
      this.bookings.set(bookings);
    } catch (err: unknown) {
      devError('Failed to load bookings:', err);
      this.error.set(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleRefresh(event: RefresherCustomEvent) {
    await this.loadBookings();
    event.target.complete();
  }

  onSearchInput(event: Event) {
    const ev = event as CustomEvent<{ value: string }>;
    this.searchQuery.set(ev.detail?.value ?? '');
  }

  openDateFilter() {
    this.showDateFilter.set(true);
  }

  closeDateFilter() {
    this.showDateFilter.set(false);
    this.editingDateField.set(null);
  }

  openDatePicker(field: 'from' | 'to') {
    this.editingDateField.set(field);
    this.pendingDateValue.set(field === 'from' ? this.dateFrom() : this.dateTo());
  }

  closeDatePicker() {
    this.editingDateField.set(null);
    this.pendingDateValue.set(null);
  }

  onDatePickerChange(event: Event) {
    const ev = event as CustomEvent<{ value?: string }>;
    this.pendingDateValue.set(ev.detail?.value ?? null);
  }

  applyDateSelection() {
    const value = this.pendingDateValue();
    const field = this.editingDateField();
    if (field === 'from' && value) {
      this.dateFrom.set(value);
    } else if (field === 'to' && value) {
      this.dateTo.set(value);
    }
    this.closeDatePicker();
  }

  clearDateFilter() {
    this.dateFrom.set(null);
    this.dateTo.set(null);
  }

  openJob(booking: ProviderBooking) {
    this.router.navigate(['/p/job', booking.id]);
  }

  getShortBookingId(id: string): string {
    return `#${id.slice(-6).toUpperCase()}`;
  }

  getServiceName(booking: ProviderBooking): string {
    const item = booking.booking_items?.[0];
    return item?.service_variants?.services?.name || (item as any)?.variant_name || 'Service';
  }

  getCustomerName(booking: ProviderBooking): string {
    return (booking as any).customers?.profiles?.full_name || 'Customer';
  }

  formatDateTime(dateString: string | null): string {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatDateOnly(dateString: string | null): string {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  }

  formatDateFull(dateString: string | null): string {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getCompletionDate(booking: ProviderBooking): string | null {
    return booking.completed_at ?? booking.finished_work_at ?? null;
  }

  isCompleted(booking: ProviderBooking): boolean {
    return this.completedStatuses.includes(booking.status as BookingStatus);
  }

  getGrandTotal(booking: ProviderBooking): number {
    return booking.grand_total_after_voucher ?? booking.grand_total ?? 0;
  }

  formatAmount(amount: number): string {
    return this.walletService.formatAmount(amount);
  }

  hasActiveDateFilter(): boolean {
    return !!this.dateFrom() || !!this.dateTo();
  }

  getStatusConfig(status: string): { label: string; color: string; icon: string } {
    return STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'medium', icon: 'ellipse' };
  }
}
