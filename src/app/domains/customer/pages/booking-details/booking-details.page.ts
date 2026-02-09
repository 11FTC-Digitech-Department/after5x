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
  IonAvatar,
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
  calendarOutline,
  timeOutline,
  locationOutline,
  personOutline,
  callOutline,
  navigateOutline,
  receiptOutline,
  checkmarkCircle,
  closeCircle,
  hourglass,
  car,
  hammer,
  alertCircle,
  imageOutline,
  chatbubbleOutline,
  arrowBack,
  chevronForward,
  cardOutline,
  walletOutline
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { BookingService } from '@core/services/booking.service';
import { BookingStatusService } from '@core/services/booking-status.service';
import { RealtimeManagerService, ConnectionMode } from '@core/services/realtime-manager.service';
import { CustomerBooking, BookingStatus, BookingTimelineRow } from '@core/models/booking.model';

// Status display configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; message: string }> = {
  [BookingStatus.FINDING_PROVIDER]: {
    label: 'Finding Provider',
    color: 'warning',
    icon: 'hourglass',
    message: 'Looking for a service provider...'
  },
  [BookingStatus.PENDING_ACCEPTANCE]: {
    label: 'Pending',
    color: 'warning',
    icon: 'hourglass',
    message: 'Waiting for provider to accept'
  },
  [BookingStatus.CONFIRMED]: {
    label: 'Confirmed',
    color: 'primary',
    icon: 'checkmark-circle',
    message: 'Your booking is confirmed!'
  },
  [BookingStatus.ON_THE_WAY]: {
    label: 'On The Way',
    color: 'tertiary',
    icon: 'car',
    message: 'Provider is on the way'
  },
  [BookingStatus.ARRIVED]: {
    label: 'Arrived',
    color: 'tertiary',
    icon: 'location-outline',
    message: 'Provider has arrived'
  },
  [BookingStatus.IN_PROGRESS]: {
    label: 'In Progress',
    color: 'secondary',
    icon: 'hammer',
    message: 'Service in progress'
  },
  [BookingStatus.PAYMENT_PENDING]: {
    label: 'Payment Due',
    color: 'warning',
    icon: 'alert-circle',
    message: 'Payment required'
  },
  [BookingStatus.PAID]: {
    label: 'Paid',
    color: 'success',
    icon: 'checkmark-circle',
    message: 'Payment received'
  },
  [BookingStatus.COMPLETED]: {
    label: 'Completed',
    color: 'success',
    icon: 'checkmark-circle',
    message: 'Service completed'
  },
  [BookingStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'danger',
    icon: 'close-circle',
    message: 'Booking cancelled'
  },
  [BookingStatus.REJECTED]: {
    label: 'Rejected',
    color: 'danger',
    icon: 'close-circle',
    message: 'Provider rejected this booking'
  },
  [BookingStatus.EXPIRED]: {
    label: 'Expired',
    color: 'medium',
    icon: 'close-circle',
    message: 'Booking expired'
  }
};

// Statuses that can be cancelled
const CANCELLABLE_STATUSES = [
  BookingStatus.FINDING_PROVIDER,
  BookingStatus.PENDING_ACCEPTANCE,
  BookingStatus.CONFIRMED,
  BookingStatus.ON_THE_WAY
];

@Component({
  selector: 'app-booking-details',
  templateUrl: './booking-details.page.html',
  styleUrls: ['./booking-details.page.scss'],
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
    IonAvatar,
    IonFooter,
    IonSpinner,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent
  ]
})
export class BookingDetailsPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private bookingService = inject(BookingService);
  private bookingStatusService = inject(BookingStatusService);
  private realtimeManager = inject(RealtimeManagerService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // State
  booking = signal<CustomerBooking | null>(null);
  isLoading = signal(true);
  isCancelling = signal(false);

  // Real-time connection state (for UI feedback)
  connectionMode = this.realtimeManager.mode;
  isConnected = this.realtimeManager.isConnected;

  // Real-time subscription
  private unsubscribeRealTime: (() => void) | null = null;

  // Computed
  statusConfig = computed(() => {
    const status = this.booking()?.status;
    return status ? STATUS_CONFIG[status] : null;
  });

  canCancel = computed(() => {
    const status = this.booking()?.status as BookingStatus;
    return CANCELLABLE_STATUSES.includes(status);
  });

  timeline = computed(() => {
    const entries = this.booking()?.booking_timeline || [];
    return [...entries].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  // Check if payment is required
  requiresPayment = computed(() => {
    const status = this.booking()?.status as BookingStatus;
    return status === BookingStatus.PAYMENT_PENDING;
  });

  constructor() {
    addIcons({
      calendarOutline,
      timeOutline,
      locationOutline,
      personOutline,
      callOutline,
      navigateOutline,
      receiptOutline,
      checkmarkCircle,
      closeCircle,
      hourglass,
      car,
      hammer,
      alertCircle,
      imageOutline,
      chatbubbleOutline,
      arrowBack,
      chevronForward,
      cardOutline,
      walletOutline
    });
  }

  async ngOnInit() {
    const bookingId = this.route.snapshot.paramMap.get('bookingId');
    if (bookingId) {
      await this.loadBooking(bookingId);
      this.setupRealTimeSubscription(bookingId);
    }
  }

  /**
   * Ionic lifecycle hook - fires every time page becomes visible
   * Used to refresh booking data when navigating back from payment page
   */
  ionViewWillEnter() {
    const bookingId = this.route.snapshot.paramMap.get('bookingId');
    // Refresh booking data if already loaded (handles navigation back from payment)
    if (bookingId && this.booking()) {
      this.refreshBookingSilently(bookingId);
    }
  }

  /**
   * Refresh booking without showing loading spinner
   * Used for background refresh when returning to page
   */
  private async refreshBookingSilently(bookingId: string) {
    try {
      const booking = await this.bookingService.getBookingById(bookingId);
      if (booking) {
        this.booking.set(booking);
      }
    } catch (error) {
      console.error('[BookingDetails] Silent refresh failed:', error);
    }
  }

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
  }

  async loadBooking(bookingId: string) {
    this.isLoading.set(true);
    try {
      const booking = await this.bookingService.getBookingById(bookingId);
      if (booking) {
        this.booking.set(booking);
      } else {
        await this.showToast('Booking not found', 'danger');
        this.router.navigate(['/c/bookings']);
      }
    } catch (error) {
      console.error('Failed to load booking:', error);
      await this.showToast('Failed to load booking details', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  private setupRealTimeSubscription(bookingId: string) {
    this.unsubscribeRealTime = this.realtimeManager.subscribeToBooking(
      bookingId,
      {
        onBookingUpdate: (updatedBooking) => {
          const current = this.booking();
          if (current) {
            const previousStatus = current.status;
            this.booking.set({ ...current, ...updatedBooking });

            // Show visual feedback when update is received
            if (previousStatus !== updatedBooking.status) {
              this.showStatusUpdateFeedback(updatedBooking.status);
            }
          }
        },
        onStatusChange: (newStatus, booking) => {
          // Show status-specific toast notification
          this.showStatusToast(newStatus);
        },
        onTimelineUpdate: (entry) => {
          const current = this.booking();
          if (current) {
            const timeline = current.booking_timeline || [];
            this.booking.set({
              ...current,
              booking_timeline: [...timeline, {
                id: entry.id,
                booking_id: entry.bookingId,
                title: entry.title,
                description: entry.description || null,
                icon_name: entry.iconName || null,
                created_at: entry.createdAt.toISOString()
              }]
            });
          }
        }
      }
    );
  }

  private async showStatusUpdateFeedback(status: string) {
    // Brief haptic/visual feedback that an update was received
    const config = STATUS_CONFIG[status];
    if (config) {
      // The UI will update automatically via signals
      console.log(`[BookingDetails] Status updated to: ${config.label}`);
    }
  }

  private async showStatusToast(status: string) {
    const config = STATUS_CONFIG[status];
    if (!config) return;

    const toast = await this.toastController.create({
      message: config.message,
      duration: 3000,
      position: 'top',
      color: config.color,
      icon: config.icon,
      buttons: [{ icon: 'close', role: 'cancel' }]
    });
    await toast.present();
  }

  async handleRefresh(event: RefresherCustomEvent) {
    const bookingId = this.booking()?.id;
    if (bookingId) {
      await this.loadBooking(bookingId);
    }
    event.target.complete();
  }

  async confirmCancel() {
    const alert = await this.alertController.create({
      header: 'Cancel Booking',
      message: 'Are you sure you want to cancel this booking? This action cannot be undone.',
      buttons: [
        {
          text: 'No, Keep It',
          role: 'cancel'
        },
        {
          text: 'Yes, Cancel',
          role: 'destructive',
          handler: () => this.cancelBooking()
        }
      ]
    });
    await alert.present();
  }

  private async cancelBooking() {
    const booking = this.booking();
    const userId = this.sessionService.profile()?.id;

    if (!booking || !userId) return;

    this.isCancelling.set(true);
    try {
      await this.bookingStatusService.cancelBooking(
        booking.id,
        'Customer requested cancellation',
        userId
      );
      await this.showToast('Booking cancelled successfully', 'success');
      await this.loadBooking(booking.id);
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      await this.showToast('Failed to cancel booking', 'danger');
    } finally {
      this.isCancelling.set(false);
    }
  }

  callProvider() {
    const phone = this.booking()?.providers?.profiles?.phone_number;
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }

  goToPayment() {
    const bookingId = this.booking()?.id;
    if (bookingId) {
      this.router.navigate(['/c/payment', bookingId]);
    }
  }

  // Helper methods
  getServiceName(): string {
    const booking = this.booking();
    const item = booking?.booking_items?.[0];
    return item?.service_variants?.services?.name || item?.variant_name || 'Service';
  }

  getServiceIcon(): string {
    const booking = this.booking();
    const item = booking?.booking_items?.[0];
    const iconUrl = item?.service_variants?.services?.service_categories?.icon_url;
    // Extract icon name from URL like 'assets/icon/locksmith.png' -> 'locksmith'
    if (iconUrl) {
      const iconName = iconUrl.split('/').pop()?.replace('.png', '') || 'construct';
      // Map to Ionic icon names
      const iconMap: Record<string, string> = {
        'locksmith': 'key-outline',
        'ac': 'snow-outline',
        'electrical': 'flash-outline',
        'automotive': 'car-outline',
        'plumbing': 'water-outline'
      };
      return iconMap[iconName] || 'construct-outline';
    }
    return 'construct-outline';
  }

  getDescription(): string {
    const booking = this.booking();
    return booking?.address_snapshot?.description || 'No description provided';
  }

  getAddress(): string {
    const booking = this.booking();
    return booking?.address_snapshot?.address || 'No address';
  }

  getProviderName(): string | null {
    return this.booking()?.providers?.profiles?.full_name || null;
  }

  getProviderAvatar(): string | null {
    return this.booking()?.providers?.profiles?.avatar_url || null;
  }

  getProviderPhone(): string | null {
    return this.booking()?.providers?.profiles?.phone_number || null;
  }

  hasBodyCamera(): boolean {
    const fee = this.booking()?.body_camera_fee;
    return fee !== null && fee !== undefined && fee > 0;
  }

  getShortBookingId(): string {
    const id = this.booking()?.id;
    return id ? `#${id.slice(-6).toUpperCase()}` : '';
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatTime(dateString: string | null): string {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatPrice(amount: number | null): string {
    if (amount === null || amount === undefined) return '---';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  getTimelineIcon(iconName: string | null): string {
    return iconName || 'ellipse';
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
