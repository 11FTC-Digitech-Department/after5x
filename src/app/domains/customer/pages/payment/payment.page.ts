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
  IonItem,
  IonLabel,
  IonInput,
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
  arrowBack,
  arrowBackOutline,
  pricetagOutline,
  trashOutline
} from 'ionicons/icons';
import { Browser, BrowserOpenOptions } from '@capacitor/browser';
import { App } from '@capacitor/app';

import { BookingService } from '@core/services/booking.service';
import { PaymentService } from '@core/services/payment.service';
import { PaymentContextService } from '@core/services/payment-context.service';
import { CustomerBooking, BookingStatus } from '@core/models/booking.model';
import { PaymentStatus, InvoiceStatus } from '@core/models/payment.model';
import { PaymentSuccessModalComponent, PaymentSuccessData } from '@shared/components/payment-success-modal/payment-success-modal.component';

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
    IonRefresherContent,
    IonItem,
    IonLabel,
    IonInput,
    PaymentSuccessModalComponent
  ]
})
export class PaymentPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private paymentService = inject(PaymentService);
  private paymentContextService = inject(PaymentContextService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  /** Booking ID from route - safe to use for back href and retry (never undefined) */
  bookingIdParam: string | null = null;

  // State
  booking = signal<CustomerBooking | null>(null);
  paymentStatus = signal<PaymentStatus | null>(null);
  isLoading = signal(true);
  isProcessing = signal(false);
  processingType = signal<'initiating' | 'verifying'>('verifying');
  error = signal<string | null>(null);
  voucherCode = signal('');
  isApplyingVoucher = signal(false);
  isRemovingVoucher = signal(false);

  // Success modal state
  showSuccessModal = signal(false);
  successModalData = signal<PaymentSuccessData | null>(null);

  // Real-time subscription and listeners
  private unsubscribePayment: (() => void) | null = null;
  private appStateListener: { remove: () => Promise<void> } | null = null;
  private syncRetryCount = 0;
  private readonly MAX_SYNC_RETRIES = 2;
  private readonly SYNC_RETRY_DELAY = 1000;

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

  voucherApplied = computed(() => {
    return !!this.booking()?.voucher_code;
  });

  getVoucherSummary(): string | null {
    const booking = this.booking();
    if (!booking || !booking.voucher_discount_type) return null;
    if (booking.voucher_discount_type === 'percent' && booking.voucher_percent_off) {
      let summary = `${booking.voucher_percent_off}% off`;
      if (booking.voucher_max_discount) {
        summary += ` (up to ${this.formatPrice(booking.voucher_max_discount)})`;
      }
      return summary;
    }
    return null;
  }

  displayTotal = computed(() => {
    const booking = this.booking();
    if (!booking) return 0;
    return booking.grand_total_after_voucher ?? booking.grand_total ?? 0;
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
      arrowBack,
      arrowBackOutline,
      pricetagOutline,
      trashOutline
    });
  }

  navigateToBookings(): void {
    this.router.navigate(['/c/bookings']);
  }

  /** Safe default back URL (never uses booking() so no /undefined) */
  get defaultBackHref(): string {
    return this.bookingIdParam ? `/c/bookings/${this.bookingIdParam}` : '/c/bookings';
  }

  /** True when error is due to missing/invalid booking ID (no retry possible) */
  get isInvalidBookingIdError(): boolean {
    return this.error() === 'Invalid booking ID' || !this.bookingIdParam;
  }

  async ngOnInit() {
    this.bookingIdParam = this.route.snapshot.paramMap.get('bookingId');
    const bookingId = this.bookingIdParam;

    // Check for return status from Xendit deeplink
    const queryStatus = this.route.snapshot.queryParamMap.get('status');
    const isReturningFromPayment = queryStatus === 'success' || queryStatus === 'failed';
    const wasInPaymentFlow = this.paymentContextService.isInPaymentFlow();

    console.log('[Payment] ngOnInit - bookingId:', bookingId, 'queryStatus:', queryStatus, 'wasInPaymentFlow:', wasInPaymentFlow);

    if (isReturningFromPayment) {
      // Show feedback immediately
      if (queryStatus === 'success') {
        await this.showToast('Verifying payment...', 'primary');
      }
      // Clear query params after reading them
      this.router.navigate([], { 
        relativeTo: this.route, 
        queryParams: {},
        replaceUrl: true // Don't add to history
      });
    }

    if (bookingId) {
      await this.loadData(bookingId);
      this.setupRealTimeSubscription(bookingId);
      this.setupAppStateListener(bookingId);

      // Sync status if returning from payment OR if we were in payment flow
      if (isReturningFromPayment || wasInPaymentFlow) {
        console.log('[Payment] Returning from payment flow, syncing status...');
        this.paymentContextService.exitPaymentFlow();
        this.syncRetryCount = 0;
        await this.syncPaymentStatusWithRetry();
      }
    } else {
      this.error.set('Invalid booking ID');
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    // Clean up payment flow context
    this.paymentContextService.exitPaymentFlow();

    if (this.unsubscribePayment) {
      this.unsubscribePayment();
    }

    // Clean up app state listener
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
  }

  async loadData(bookingId: string) {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Load booking and payment status in parallel
      const { booking, status } = await this.fetchPaymentPageData(bookingId);

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

  private async fetchPaymentPageData(bookingId: string): Promise<{ booking: CustomerBooking | null; status: PaymentStatus }> {
    const [booking, status] = await Promise.all([
      this.bookingService.getBookingById(bookingId),
      this.paymentService.getPaymentStatus(bookingId)
    ]);

    return { booking, status };
  }

  private setupRealTimeSubscription(bookingId: string) {
    this.unsubscribePayment = this.paymentService.subscribeToPaymentStatus(
      bookingId,
      (status) => {
        console.log('[Payment] Real-time status update:', status);
        this.paymentStatus.set(status);

        // Show success modal when payment is confirmed via real-time
        if (status.invoiceStatus === 'PAID' && !this.showSuccessModal()) {
          console.log('[Payment] Real-time: Payment confirmed! Showing success modal...');
          this.successModalData.set({
            amount: status.amount,
            paymentMethod: status.paymentMethod,
            bookingId: bookingId
          });
          this.showSuccessModal.set(true);
        }
      }
    );
  }

  /**
   * Set up app state listener to detect when app resumes after payment
   */
  private async setupAppStateListener(bookingId: string) {
    try {
      this.appStateListener = await App.addListener('appStateChange', async ({ isActive }) => {
        console.log('[Payment] App state changed, isActive:', isActive);
        
        // When app becomes active and we were in payment flow, sync status
        if (isActive && this.paymentContextService.isInPaymentFlow()) {
          console.log('[Payment] App resumed during payment flow, syncing...');
          this.paymentContextService.exitPaymentFlow();
          this.syncRetryCount = 0;
          await this.syncPaymentStatusWithRetry();
        }
      });
    } catch (err) {
      // App listener might not work on web
      console.log('[Payment] Could not set up app state listener:', err);
    }
  }

  /**
   * Sync payment status with retry logic
   * Xendit may have a slight delay between payment and status update
   */
  private async syncPaymentStatusWithRetry() {
    const bookingId = this.booking()?.id;
    if (!bookingId) {
      console.warn('[Payment] syncPaymentStatusWithRetry: No bookingId');
      return;
    }

    this.processingType.set('verifying');
    this.isProcessing.set(true);

    try {
      console.log(`[Payment] Sync attempt ${this.syncRetryCount + 1}/${this.MAX_SYNC_RETRIES + 1}`);
      const result = await this.paymentService.syncInvoiceStatus(bookingId);
      console.log('[Payment] syncInvoiceStatus result:', result);

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

        // If payment confirmed, show success modal
        if (result.invoiceStatus === 'PAID') {
          console.log('[Payment] Payment confirmed! Showing success modal...');
          this.isProcessing.set(false);
          this.successModalData.set({
            amount: result.amount,
            paymentMethod: result.paymentMethod ?? null,
            bookingId: bookingId
          });
          this.showSuccessModal.set(true);
          return;
        }

        // If still PENDING and we haven't maxed out retries, try again
        if (result.invoiceStatus === 'PENDING' && this.syncRetryCount < this.MAX_SYNC_RETRIES) {
          this.syncRetryCount++;
          console.log(`[Payment] Status still PENDING, retrying in ${this.SYNC_RETRY_DELAY}ms...`);
          setTimeout(() => {
            this.syncPaymentStatusWithRetry();
          }, this.SYNC_RETRY_DELAY);
          return;
        }

        // Max retries reached or non-PENDING status
        if (result.invoiceStatus === 'PENDING') {
          console.log('[Payment] Max sync retries reached, status still PENDING');
          await this.showToast('Payment verification in progress. Please wait or pull to refresh.', 'warning');
        }
      }
    } catch (err) {
      console.error('[Payment] Sync error:', err);
      
      // Retry on error if we haven't maxed out
      if (this.syncRetryCount < this.MAX_SYNC_RETRIES) {
        this.syncRetryCount++;
        console.log(`[Payment] Sync error, retrying in ${this.SYNC_RETRY_DELAY}ms...`);
        setTimeout(() => {
          this.syncPaymentStatusWithRetry();
        }, this.SYNC_RETRY_DELAY);
        return;
      }
    } finally {
      // Only clear processing if we're done retrying
      if (this.syncRetryCount >= this.MAX_SYNC_RETRIES) {
        this.isProcessing.set(false);
      }
    }
  }

  async handleRefresh(event: RefresherCustomEvent) {
    const bookingId = this.bookingIdParam ?? this.booking()?.id;
    if (bookingId) {
      await this.loadData(bookingId);
    }
    event.target.complete();
  }

  async applyVoucher() {
    const bookingId = this.booking()?.id;
    const code = this.voucherCode().trim();
    if (!bookingId || !code) {
      await this.showToast('Enter a voucher code', 'warning');
      return;
    }

    if (this.voucherApplied()) {
      await this.showToast('Voucher already applied', 'warning');
      return;
    }

    this.isApplyingVoucher.set(true);
    try {
      await this.paymentService.redeemVoucher(bookingId, code);
      this.voucherCode.set('');
      const { booking, status } = await this.fetchPaymentPageData(bookingId);
      if (booking) {
        this.booking.set(booking);
      }
      this.paymentStatus.set(status);
      await this.showToast('Voucher applied', 'success');
    } catch (err: any) {
      console.error('[Voucher] Redeem failed', {
        bookingId,
        code,
        message: err?.message ?? err
      });
      await this.showToast('Invalid voucher code', 'danger');
    } finally {
      this.isApplyingVoucher.set(false);
    }
  }

  async removeVoucher() {
    const bookingId = this.booking()?.id;
    if (!bookingId || !this.voucherApplied()) return;

    this.isRemovingVoucher.set(true);
    try {
      await this.paymentService.removeVoucher(bookingId);
      const { booking, status } = await this.fetchPaymentPageData(bookingId);
      if (booking) {
        this.booking.set(booking);
      }
      this.paymentStatus.set(status);
      await this.showToast('Voucher removed', 'success');
    } catch (err: any) {
      console.error('[Voucher] Remove failed', {
        bookingId,
        message: err?.message ?? err
      });
      await this.showToast('Unable to remove voucher', 'danger');
    } finally {
      this.isRemovingVoucher.set(false);
    }
  }

  async initiatePayment() {
    const bookingId = this.booking()?.id;
    if (!bookingId) return;

    this.processingType.set('initiating');
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
      // Mark that we're entering payment flow (for auth state handling on return)
      this.paymentContextService.enterPaymentFlow();
      this.syncRetryCount = 0;

      // Listen for browser close - sync status when user returns
      const browserFinishedListener = await Browser.addListener('browserFinished', async () => {
        console.log('[Payment] Browser closed, syncing payment status...');
        browserFinishedListener.remove();
        
        // Exit payment flow and sync with retry logic
        this.paymentContextService.exitPaymentFlow();
        
        // Give a moment for any deeplink handling to complete
        setTimeout(() => {
          this.syncPaymentStatusWithRetry();
        }, 500);
      });

      // Open in-app browser - use fullscreen for better redirect handling
      await Browser.open({
        url,
        presentationStyle: 'fullscreen',
        toolbarColor: '#667eea'
      });
    } catch (err) {
      // Fallback to window.open for web
      console.log('[Payment] Opening payment URL in browser window');
      window.open(url, '_blank');
      
      // For web, show a message to manually refresh
      await this.showToast('Complete payment in the new tab, then refresh this page', 'primary');
    }
  }

  /**
   * Public sync method - uses the retry logic internally
   */
  async syncPaymentStatus() {
    console.log('[Payment] syncPaymentStatus called');
    this.syncRetryCount = 0;
    await this.syncPaymentStatusWithRetry();
  }

  /**
   * Handle success modal dismiss - navigate to booking details
   */
  onSuccessModalDismiss() {
    console.log('[Payment] Success modal dismissed, navigating to bookings list');
    this.showSuccessModal.set(false);
    this.successModalData.set(null);
    this.router.navigate(['/c/bookings']);
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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
