import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonChip,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonText,
  IonButton,
  IonAvatar,
  ToastController,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns';
import {
  calendarOutline,
  timeOutline,
  locationOutline,
  personOutline,
  chevronForward,
  filterOutline,
  swapVerticalOutline,
  clipboardOutline,
  checkmarkCircle,
  closeCircle,
  hourglass,
  car,
  hammer,
  alertCircle,
  refreshOutline
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { BookingService } from '@core/services/booking.service';
import { RealtimeManagerService, ConnectionMode } from '@core/services/realtime-manager.service';
import { CustomerBooking, BookingStatus } from '@core/models/booking.model';

type FilterStatus = 'all' | 'active' | 'completed' | 'cancelled';
type SortBy = 'date' | 'status';
type SortDirection = 'asc' | 'desc';

// Status categorization
const ACTIVE_STATUSES = [
  BookingStatus.FINDING_PROVIDER,
  BookingStatus.PENDING_ACCEPTANCE,
  BookingStatus.CONFIRMED,
  BookingStatus.ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.PAYMENT_PENDING
];

const COMPLETED_STATUSES = [
  BookingStatus.COMPLETED,
  BookingStatus.PAID
];

const CANCELLED_STATUSES = [
  BookingStatus.CANCELLED,
  BookingStatus.REJECTED,
  BookingStatus.EXPIRED
];

// Status display configuration
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
  [BookingStatus.EXPIRED]: { label: 'Expired', color: 'medium', icon: 'close-circle' }
};

@Component({
  selector: 'app-bookings',
  templateUrl: './bookings.page.html',
  styleUrls: ['./bookings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonCard,
    IonCardContent,
    IonIcon,
    IonBadge,
    IonChip,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonText,
    IonButton,
    IonAvatar
  ]
})
export class BookingsPage implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private bookingService = inject(BookingService);
  private realtimeManager = inject(RealtimeManagerService);
  private toastController = inject(ToastController);
  private router = inject(Router);

  // State signals
  bookings = signal<CustomerBooking[]>([]);
  isLoading = signal(true);
  filterStatus = signal<FilterStatus>('all');
  sortBy = signal<SortBy>('date');
  sortDirection = signal<SortDirection>('desc');

  // Real-time connection state (for UI feedback)
  connectionMode = this.realtimeManager.mode;
  isConnected = this.realtimeManager.isConnected;

  // Real-time subscription cleanup
  private unsubscribeRealTime: (() => void) | null = null;
  private isSubscribed = false; // Guard against duplicate subscriptions

  // Debug mode for troubleshooting real-time issues
  private debugMode = false;

  // Track if initial data load happened (prevents duplicate loads from effect)
  private dataLoaded = signal(false);

  // Computed: filtered and sorted bookings
  filteredBookings = computed(() => {
    let result = [...this.bookings()];

    // Apply filter
    const filter = this.filterStatus();
    if (filter === 'active') {
      result = result.filter(b => ACTIVE_STATUSES.includes(b.status as BookingStatus));
    } else if (filter === 'completed') {
      result = result.filter(b => COMPLETED_STATUSES.includes(b.status as BookingStatus));
    } else if (filter === 'cancelled') {
      result = result.filter(b => CANCELLED_STATUSES.includes(b.status as BookingStatus));
    }

    // Apply sort
    const sortField = this.sortBy();
    const direction = this.sortDirection();

    result.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'date') {
        const dateA = new Date(a.scheduled_for || a.created_at).getTime();
        const dateB = new Date(b.scheduled_for || b.created_at).getTime();
        comparison = dateA - dateB;
      } else if (sortField === 'status') {
        const orderA = this.getStatusOrder(a.status as BookingStatus);
        const orderB = this.getStatusOrder(b.status as BookingStatus);
        comparison = orderA - orderB;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return result;
  });

  // Computed: booking counts by category
  activeCount = computed(() =>
    this.bookings().filter(b => ACTIVE_STATUSES.includes(b.status as BookingStatus)).length
  );

  completedCount = computed(() =>
    this.bookings().filter(b => COMPLETED_STATUSES.includes(b.status as BookingStatus)).length
  );

  cancelledCount = computed(() =>
    this.bookings().filter(b => CANCELLED_STATUSES.includes(b.status as BookingStatus)).length
  );

  constructor() {
    addIcons({
      calendarOutline,
      timeOutline,
      locationOutline,
      personOutline,
      chevronForward,
      filterOutline,
      swapVerticalOutline,
      clipboardOutline,
      checkmarkCircle,
      closeCircle,
      hourglass,
      car,
      hammer,
      alertCircle,
      refreshOutline
    });

    // Reactive effect: load data when profile becomes available
    // This handles the case where profile loads after ngOnInit
    effect(() => {
      const profile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      // Only trigger if we have profile, session is not loading, and haven't loaded data yet
      if (profile?.id && !isLoading && !this.dataLoaded()) {
        this.loadBookings();
        this.setupRealTimeSubscription();
      }
    });
  }

  async ngOnInit() {
    // Fast path: if profile is already available, load immediately
    // Otherwise, the effect will trigger when profile becomes available
    if (this.sessionService.profile()?.id) {
      await this.loadBookings();
      this.setupRealTimeSubscription();
    }
  }

  /**
   * Ionic lifecycle hook - fires every time page becomes visible
   * Used to refresh bookings when navigating back from payment page
   */
  ionViewWillEnter() {
    // Only refresh if data was already loaded (page was visited before)
    // This ensures we get fresh data after payment completion
    if (this.dataLoaded() && this.sessionService.profile()?.id) {
      this.refreshBookingsSilently();
    }
  }

  /**
   * Refresh bookings without showing loading spinner
   * Used for background refresh when returning to page
   */
  private async refreshBookingsSilently() {
    const profile = this.sessionService.profile();
    if (!profile?.id) return;

    try {
      const bookings = await this.bookingService.getCustomerBookings(profile.id);
      this.bookings.set(bookings);
    } catch (error) {
      console.error('[BookingsPage] Silent refresh failed:', error);
    }
  }

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
      this.unsubscribeRealTime = null;
    }
    this.isSubscribed = false;
  }

  async loadBookings() {
    const profile = this.sessionService.profile();
    if (!profile?.id) {
      this.isLoading.set(false);
      return;
    }

    // Mark as loaded to prevent duplicate loads from effect
    this.dataLoaded.set(true);
    this.isLoading.set(true);

    try {
      const bookings = await this.bookingService.getCustomerBookings(profile.id);
      this.bookings.set(bookings);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      await this.showToast('Failed to load bookings', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  private setupRealTimeSubscription() {
    const profile = this.sessionService.profile();
    if (!profile?.id) return;

    // Guard against duplicate subscriptions
    if (this.isSubscribed) {
      this.debugLog('Subscription already active, skipping duplicate setup');
      return;
    }

    this.debugLog('Setting up real-time subscription for customer:', profile.id);
    this.isSubscribed = true;

    this.unsubscribeRealTime = this.realtimeManager.subscribeToCustomerBookings(
      profile.id,
      async (updatedBooking, oldStatus, newStatus) => {
        this.debugLog('Real-time event received:', {
          bookingId: updatedBooking.id,
          oldStatus,
          newStatus
        });

        const currentBookings = this.bookings();
        const index = currentBookings.findIndex(b => b.id === updatedBooking.id);

        if (index >= 0) {
          // Status changed - fetch full booking to get nested relations
          if (oldStatus && newStatus && oldStatus !== newStatus) {
            this.debugLog('Status changed, fetching full booking data');

            try {
              // Fetch complete booking with all relations
              const fullBooking = await this.bookingService.getBookingById(updatedBooking.id);

              if (fullBooking) {
                this.debugLog('Full booking fetched successfully');
                const updated = [...currentBookings];
                updated[index] = fullBooking;
                this.bookings.set(updated);
              } else {
                // Fallback: merge partial data if full fetch fails
                this.debugLog('Full fetch returned null, using partial merge');
                const updated = [...currentBookings];
                updated[index] = { ...updated[index], ...updatedBooking };
                this.bookings.set(updated);
              }
            } catch (error) {
              // Fallback: merge partial data on error
              console.error('Failed to fetch full booking:', error);
              this.debugLog('Fetch failed, using partial merge fallback');
              const updated = [...currentBookings];
              updated[index] = { ...updated[index], ...updatedBooking };
              this.bookings.set(updated);
            }

            // Show status change notification
            this.showStatusChangeToast(updatedBooking, oldStatus, newStatus);
          } else {
            // Non-status update - just merge the partial data
            this.debugLog('Non-status update, merging partial data');
            const updated = [...currentBookings];
            updated[index] = { ...updated[index], ...updatedBooking };
            this.bookings.set(updated);
          }
        } else {
          // New booking - reload full list to get related data
          this.debugLog('New booking detected, reloading full list');
          await this.loadBookings();
          this.showToast('New booking received', 'primary');
        }
      }
    );

    this.debugLog('Real-time subscription established');
  }

  private debugLog(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.log(`[BookingsPage] ${message}`, ...args);
    }
  }

  /**
   * Enable debug mode for troubleshooting real-time issues
   */
  enableDebugMode(): void {
    this.debugMode = true;
    this.realtimeManager.setDebugMode(true);
    console.log('[BookingsPage] Debug mode enabled');
  }

  private async showStatusChangeToast(booking: any, oldStatus: string, newStatus: string) {
    const config = STATUS_CONFIG[newStatus];
    if (!config) return;

    const serviceName = this.getServiceName(booking);
    const message = `${serviceName}: ${config.label}`;

    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color: config.color,
      icon: config.icon,
      buttons: [
        {
          text: 'View',
          handler: () => {
            this.navigateToBookingDetails(booking);
          }
        },
        { icon: 'close', role: 'cancel' }
      ]
    });
    await toast.present();
  }

  async handleRefresh(event: RefresherCustomEvent) {
    await this.loadBookings();
    event.target.complete();
  }

  toggleSortBy() {
    this.sortBy.set(this.sortBy() === 'date' ? 'status' : 'date');
  }

  toggleSortDirection() {
    this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
  }

  navigateToBookingDetails(booking: CustomerBooking) {
    this.router.navigate(['/c/bookings', booking.id]);
  }

  navigateToHome() {
    this.router.navigate(['/c/home']);
  }

  // Helper methods for template
  getServiceName(booking: CustomerBooking): string {
    const item = booking.booking_items?.[0];
    return item?.service_variants?.services?.name || item?.variant_name || 'Service';
  }

  getServiceIcon(booking: CustomerBooking): string {
    const item = booking.booking_items?.[0];
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

  getProviderName(booking: CustomerBooking): string | null {
    return booking.providers?.profiles?.full_name || null;
  }

  getProviderAvatar(booking: CustomerBooking): string | null {
    return booking.providers?.profiles?.avatar_url || null;
  }

  getStatusConfig(status: string): { label: string; color: string; icon: string } {
    return STATUS_CONFIG[status] || { label: status, color: 'medium', icon: 'help-circle' };
  }

  isActiveStatus(status: string): boolean {
    return ACTIVE_STATUSES.includes(status as BookingStatus);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();

    // For recent dates, use relative formatting
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else if (isThisWeek(date)) {
      return `${format(date, 'EEEE \'at\' h:mm a')}`;
    } else {
      // For older dates, show date and time
      return format(date, 'MMM d \'at\' h:mm a');
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

  private getStatusOrder(status: BookingStatus): number {
    // Active statuses first, then completed, then cancelled
    if (ACTIVE_STATUSES.includes(status)) return 1;
    if (COMPLETED_STATUSES.includes(status)) return 2;
    if (CANCELLED_STATUSES.includes(status)) return 3;
    return 4;
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
