import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonBadge,
  IonButton,
  IonFooter,
  IonSpinner,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  ToastController,
  AlertController,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cardOutline,
  checkmarkCircle,
  closeCircle,
  alertCircle,
  receiptOutline,
  timeOutline,
  walletOutline,
  refreshOutline,
  openOutline,
  shieldCheckmarkOutline,
  arrowBack
} from 'ionicons/icons';
import { Browser } from '@capacitor/browser';

import { BookingService } from '@core/services/booking.service';
import { PaymentService } from '@core/services/payment.service';
import { CustomerBooking, BookingStatus } from '@core/models/booking.model';
import { PaymentStatus, InvoiceStatus } from '@core/models/payment.model';

// Status display configuration
const PAYMENT_STATUS_CONFIG: Record<InvoiceStatus | 'NONE', { label: string; color: string; icon: string; message: string }> = {
  'NONE': {
    label: 'No Invoice',
    color: 'medium',
    icon: 'wallet-outline',
    message: 'Click "Pay Now" to initiate payment'
  },
  'PENDING': {
    label: 'Awaiting Payment',
    color: 'warning',
    icon: 'time-outline',
    message: 'Complete your payment to proceed'
  },
  'PAID': {
    label: 'Payment Complete',
    color: 'success',
    icon: 'checkmark-circle',
    message: 'Thank you for your payment!'
  },
  'EXPIRED': {
    label: 'Invoice Expired',
    color: 'danger',
    icon: 'close-circle',
    message: 'Your invoice has expired. Click "Retry Payment" to generate a new one.'
  },
  'FAILED': {
    label: 'Payment Failed',
    color: 'danger',
    icon: 'alert-circle',
    message: 'Payment could not be processed. Please try again.'
  }
};

@Component({
  selector: 'app-payment',
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonBadge,
    IonButton,
    IonFooter,
    IonSpinner,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent
  ]
})
export class PaymentPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private paymentService = inject(PaymentService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // State
  booking = signal<CustomerBooking | null>(null);
  paymentStatus = signal<PaymentStatus | null>(null);
  isLoading = signal(true);
  isProcessing = signal(false);
  error = signal<string | null>(null);

  // Real-time subscription
  private unsubscribePayment: (() => void) | null = null;

  // Computed
  statusConfig = computed(() => {
    const status = this.paymentStatus()?.invoiceStatus || 'NONE';
    return PAYMENT_STATUS_CONFIG[status];
  });

  canPay = computed(() => {
    const status = this.paymentStatus();
    if (!status) return false;
    // Can pay if no invoice, invoice expired, or invoice failed
    return status.invoiceStatus === 'NONE' ||
           status.invoiceStatus === 'EXPIRED' ||
           status.invoiceStatus === 'FAILED';
  });

  canRetryPayment = computed(() => {
    const status = this.paymentStatus();
    return status?.invoiceStatus === 'EXPIRED' || status?.invoiceStatus === 'FAILED';
  });

  hasPendingInvoice = computed(() => {
    const status = this.paymentStatus();
    return status?.invoiceStatus === 'PENDING' && status?.invoiceUrl;
  });

  isPaid = computed(() => {
    const status = this.paymentStatus();
    return status?.invoiceStatus === 'PAID' ||
           status?.bookingStatus === 'paid' ||
           status?.bookingStatus === 'completed';
  });

  constructor() {
    addIcons({
      cardOutline,
      checkmarkCircle,
      closeCircle,
      alertCircle,
      receiptOutline,
      timeOutline,
      walletOutline,
      refreshOutline,
      openOutline,
      shieldCheckmarkOutline,
      arrowBack
    });
  }

  async ngOnInit() {
    const bookingId = this.route.snapshot.paramMap.get('bookingId');

    // Check for return status from Xendit
    const queryStatus = this.route.snapshot.queryParamMap.get('status');
    if (queryStatus === 'success' || queryStatus === 'failed') {
      // Clear query params
      this.router.navigate([], { relativeTo: this.route, queryParams: {} });

      if (queryStatus === 'success') {
        // Show success feedback while we sync
        await this.showToast('Verifying payment...', 'primary');
      }
    }

    if (bookingId) {
      await this.loadData(bookingId);
      this.setupRealTimeSubscription(bookingId);

      // If returning from payment, sync status
      if (queryStatus) {
        await this.syncPaymentStatus();
      }
    } else {
      this.error.set('Invalid booking ID');
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.unsubscribePayment) {
      this.unsubscribePayment();
    }
  }

  async loadData(bookingId: string) {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Load booking and payment status in parallel
      const [booking, status] = await Promise.all([
        this.bookingService.getBookingById(bookingId),
        this.paymentService.getPaymentStatus(bookingId)
      ]);

      if (!booking) {
        this.error.set('Booking not found');
        return;
      }

      this.booking.set(booking);
      this.paymentStatus.set(status);

      // If booking is not in payment pending state and not paid, redirect
      if (booking.status !== BookingStatus.PAYMENT_PENDING &&
          booking.status !== BookingStatus.PAID &&
          booking.status !== BookingStatus.COMPLETED) {
        await this.showToast('This booking does not require payment at this time', 'warning');
        this.router.navigate(['/c/bookings', bookingId]);
      }
    } catch (err) {
      console.error('Failed to load payment data:', err);
      this.error.set('Failed to load payment information');
    } finally {
      this.isLoading.set(false);
    }
  }

  private setupRealTimeSubscription(bookingId: string) {
    this.unsubscribePayment = this.paymentService.subscribeToPaymentStatus(
      bookingId,
      (status) => {
        console.log('[Payment] Real-time status update:', status);
        this.paymentStatus.set(status);

        // Show toast for status changes
        if (status.invoiceStatus === 'PAID') {
          this.showToast('Payment successful!', 'success');
          // Redirect to booking details after short delay
          setTimeout(() => {
            this.router.navigate(['/c/bookings', bookingId]);
          }, 2000);
        }
      }
    );
  }

  async handleRefresh(event: RefresherCustomEvent) {
    const bookingId = this.booking()?.id;
    if (bookingId) {
      await this.loadData(bookingId);
    }
    event.target.complete();
  }

  async initiatePayment() {
    const bookingId = this.booking()?.id;
    if (!bookingId) return;

    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const result = await this.paymentService.initiatePayment(bookingId);

      if (result.success && result.invoiceUrl) {
        // Update local state
        this.paymentStatus.update(status => status ? {
          ...status,
          invoiceStatus: 'PENDING' as InvoiceStatus,
          invoiceId: result.invoiceId,
          invoiceUrl: result.invoiceUrl,
          expiresAt: result.expiresAt
        } : null);

        // Open Xendit payment page
        await this.openPaymentUrl(result.invoiceUrl);
      } else {
        throw new Error(result.error || 'Failed to create payment invoice');
      }
    } catch (err: any) {
      console.error('Payment initiation failed:', err);
      this.error.set(err.message || 'Failed to initiate payment');
      await this.showToast('Failed to initiate payment. Please try again.', 'danger');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async continuePayment() {
    const invoiceUrl = this.paymentStatus()?.invoiceUrl;
    if (invoiceUrl) {
      await this.openPaymentUrl(invoiceUrl);
    }
  }

  private async openPaymentUrl(url: string) {
    try {
      // Open in-app browser
      await Browser.open({
        url,
        presentationStyle: 'popover',
        toolbarColor: '#ffffff'
      });
    } catch (err) {
      // Fallback to window.open for web
      window.open(url, '_blank');
    }
  }

  async syncPaymentStatus() {
    const bookingId = this.booking()?.id;
    if (!bookingId) return;

    this.isProcessing.set(true);

    try {
      const result = await this.paymentService.syncInvoiceStatus(bookingId);

      if (result.success) {
        this.paymentStatus.set({
          bookingId: result.bookingId,
          invoiceId: result.invoiceId,
          invoiceUrl: result.invoiceUrl,
          invoiceStatus: result.invoiceStatus,
          bookingStatus: result.bookingStatus,
          amount: result.amount,
          paidAt: result.paidAt || null,
          paymentMethod: result.paymentMethod || null,
          paymentChannel: result.paymentChannel || null,
          expiresAt: result.expiresAt || null
        });

        if (result.synced && result.invoiceStatus === 'PAID') {
          await this.showToast('Payment confirmed!', 'success');
          setTimeout(() => {
            this.router.navigate(['/c/bookings', bookingId]);
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Failed to sync payment status:', err);
    } finally {
      this.isProcessing.set(false);
    }
  }

  // Helper methods
  getServiceName(): string {
    const booking = this.booking();
    const item = booking?.booking_items?.[0];
    return item?.service_variants?.services?.name || item?.variant_name || 'Service';
  }

  getShortBookingId(): string {
    const id = this.booking()?.id;
    return id ? `#${id.slice(-6).toUpperCase()}` : '';
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatPrice(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '---';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatPaymentMethod(): string {
    const status = this.paymentStatus();
    return this.paymentService.formatPaymentMethod(
      status?.paymentMethod || null,
      status?.paymentChannel || null
    );
  }

  isInvoiceExpired(): boolean {
    const expiresAt = this.paymentStatus()?.expiresAt;
    return this.paymentService.isInvoiceExpired(expiresAt || null);
  }

  getExpiryTime(): string {
    const expiresAt = this.paymentStatus()?.expiresAt;
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  private async showToast(message: string, color: string = 'primary') {
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
