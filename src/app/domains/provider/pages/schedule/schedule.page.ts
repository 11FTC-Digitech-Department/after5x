import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonBadge,
  IonCard,
  IonCardContent,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  timeOutline,
  locationOutline,
  personOutline,
  checkmarkCircle,
  closeCircle,
  hourglass,
  car,
  hammer,
  alertCircle,
  chevronForward,
  briefcaseOutline,
  documentTextOutline
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { ProviderBookingService, ProviderBooking } from '@core/services/provider-booking.service';
import { RealTimeService } from '@core/services/real-time.service';
import { BookingStatus } from '@core/models/booking.model';

// Status display configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  [BookingStatus.PENDING_ACCEPTANCE]: {
    label: 'Pending',
    color: 'warning',
    icon: 'hourglass'
  },
  [BookingStatus.CONFIRMED]: {
    label: 'Confirmed',
    color: 'primary',
    icon: 'checkmark-circle'
  },
  [BookingStatus.ON_THE_WAY]: {
    label: 'On The Way',
    color: 'tertiary',
    icon: 'car'
  },
  [BookingStatus.ARRIVED]: {
    label: 'Arrived',
    color: 'tertiary',
    icon: 'location-outline'
  },
  [BookingStatus.IN_PROGRESS]: {
    label: 'In Progress',
    color: 'secondary',
    icon: 'hammer'
  },
  [BookingStatus.PAYMENT_PENDING]: {
    label: 'Payment Due',
    color: 'warning',
    icon: 'alert-circle'
  },
  [BookingStatus.PAID]: {
    label: 'Paid',
    color: 'success',
    icon: 'checkmark-circle'
  },
  [BookingStatus.COMPLETED]: {
    label: 'Completed',
    color: 'success',
    icon: 'checkmark-circle'
  },
  [BookingStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'danger',
    icon: 'close-circle'
  },
  [BookingStatus.REJECTED]: {
    label: 'Rejected',
    color: 'danger',
    icon: 'close-circle'
  }
};

type SegmentType = 'incoming' | 'active' | 'history';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonBadge,
    IonCard,
    IonCardContent,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent
  ]
})
export class SchedulePage implements OnInit, OnDestroy {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private providerBookingService = inject(ProviderBookingService);
  private realTimeService = inject(RealTimeService);
  private toastController = inject(ToastController);

  // State
  providerId = signal<string | null>(null);
  bookings = signal<ProviderBooking[]>([]);
  isLoading = signal(true);
  selectedSegment = signal<SegmentType>('incoming');

  // Real-time subscription
  private unsubscribeRealTime: (() => void) | null = null;

  // Track if initial data load happened (prevents duplicate loads from effect)
  private dataLoaded = signal(false);

  // Computed
  incomingJobs = computed(() =>
    this.bookings().filter(b => b.status === BookingStatus.PENDING_ACCEPTANCE)
  );

  activeJobs = computed(() =>
    this.bookings().filter(b =>
      [BookingStatus.CONFIRMED, BookingStatus.ON_THE_WAY, BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS].includes(b.status as BookingStatus)
    )
  );

  historyJobs = computed(() =>
    this.bookings().filter(b =>
      [BookingStatus.PAYMENT_PENDING, BookingStatus.PAID, BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED].includes(b.status as BookingStatus)
    )
  );

  displayedJobs = computed(() => {
    switch (this.selectedSegment()) {
      case 'incoming':
        return this.incomingJobs();
      case 'active':
        return this.activeJobs();
      case 'history':
        return this.historyJobs();
      default:
        return [];
    }
  });

  incomingCount = computed(() => this.incomingJobs().length);

  constructor() {
    addIcons({
      calendarOutline,
      timeOutline,
      locationOutline,
      personOutline,
      checkmarkCircle,
      closeCircle,
      hourglass,
      car,
      hammer,
      alertCircle,
      chevronForward,
      briefcaseOutline,
      documentTextOutline
    });

    // Reactive effect: load data when profile becomes available
    // This handles the case where profile loads after ngOnInit
    effect(() => {
      const profile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      // Only trigger if we have a provider profile, session is not loading, and haven't loaded data yet
      if (profile?.id && profile?.role === 'provider' && !isLoading && !this.dataLoaded()) {
        this.providerId.set(profile.id);
        this.loadBookings();
        this.setupRealTimeSubscription();
      }
    });
  }

  async ngOnInit() {
    // Fast path: if profile is already available, load immediately
    // Otherwise, the effect will trigger when profile becomes available
    const profile = this.sessionService.profile();
    if (profile?.id && profile?.role === 'provider') {
      this.providerId.set(profile.id);
      await this.loadBookings();
      this.setupRealTimeSubscription();
    }
    // If profile not available yet, effect will handle loading when it arrives
  }

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
  }

  async loadBookings() {
    const providerId = this.providerId();
    if (!providerId) return;

    // Mark as loaded to prevent duplicate loads from effect
    this.dataLoaded.set(true);
    this.isLoading.set(true);

    try {
      const bookings = await this.providerBookingService.getProviderBookings(providerId);
      this.bookings.set(bookings);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      await this.showToast('Failed to load jobs', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  private setupRealTimeSubscription() {
    const providerId = this.providerId();
    if (!providerId) return;

    this.unsubscribeRealTime = this.realTimeService.subscribeToProviderBookings(
      providerId,
      async (booking, oldStatus, newStatus) => {
        // Refresh bookings when there's an update
        await this.loadBookings();

        // Show toast for new jobs
        if (!oldStatus && newStatus === BookingStatus.PENDING_ACCEPTANCE) {
          await this.showToast('New job request received!', 'primary');
        }
      }
    );
  }

  onSegmentChange(event: CustomEvent) {
    this.selectedSegment.set(event.detail.value as SegmentType);
  }

  async handleRefresh(event: RefresherCustomEvent) {
    await this.loadBookings();
    event.target.complete();
  }

  openJob(booking: ProviderBooking) {
    this.router.navigate(['/p/job', booking.id]);
  }

  // Helper methods
  getStatusConfig(status: string) {
    return STATUS_CONFIG[status] || { label: status, color: 'medium', icon: 'ellipse' };
  }

  getServiceName(booking: ProviderBooking): string {
    const item = booking.booking_items?.[0];
    return item?.service_variants?.services?.name || item?.variant_name || 'Service';
  }

  getCustomerName(booking: ProviderBooking): string {
    return (booking as any).customers?.profiles?.full_name || 'Customer';
  }

  getAddress(booking: ProviderBooking): string {
    return booking.address_snapshot?.address || 'No address';
  }

  formatDateTime(dateString: string | null): string {
    if (!dateString) return '---';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (isToday) {
      return `Today, ${timeStr}`;
    } else if (isTomorrow) {
      return `Tomorrow, ${timeStr}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  }

  formatPrice(amount: number | null): string {
    if (amount === null || amount === undefined) return '---';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  getShortBookingId(id: string): string {
    return `#${id.slice(-6).toUpperCase()}`;
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
