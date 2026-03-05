import { devError } from '../../../../core/utils/logger';
import { Component, OnInit, inject, signal } from '@angular/core';
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
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { receiptOutline } from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { ProviderBookingService, ProviderBooking } from '@core/services/provider-booking.service';
import { WalletService } from '@core/services/wallet.service';

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
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText
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

  constructor() {
    addIcons({ receiptOutline });
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

  openJob(booking: ProviderBooking) {
    this.router.navigate(['/p/job', booking.id]);
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

  getGrandTotal(booking: ProviderBooking): number {
    return booking.grand_total_after_voucher ?? booking.grand_total ?? 0;
  }

  formatAmount(amount: number): string {
    return this.walletService.formatAmount(amount);
  }
}
