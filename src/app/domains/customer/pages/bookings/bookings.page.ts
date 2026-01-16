import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
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
import { RealTimeService } from '@core/services/real-time.service';
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
  private realTimeService = inject(RealTimeService);
  private toastController = inject(ToastController);
  private router = inject(Router);

  // State signals
  bookings = signal<CustomerBooking[]>([]);
  isLoading = signal(true);
  filterStatus = signal<FilterStatus>('all');
  sortBy = signal<SortBy>('date');
  sortDirection = signal<SortDirection>('desc');

  // Real-time subscription cleanup
  private unsubscribeRealTime: (() => void) | null = null;

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
  }

  async ngOnInit() {
    await this.loadBookings();
    this.setupRealTimeSubscription();
  }

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
  }

  async loadBookings() {
    const profile = this.sessionService.profile();
    if (!profile?.id) {
      this.isLoading.set(false);
      return;
    }

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

    this.unsubscribeRealTime = this.realTimeService.subscribeToCustomerBookings(
      profile.id,
      async (updatedBooking, oldStatus, newStatus) => {
        // Update local state
        const currentBookings = this.bookings();
        const index = currentBookings.findIndex(b => b.id === updatedBooking.id);

        if (index >= 0) {
          // Update existing booking
          const updated = [...currentBookings];
          updated[index] = { ...updated[index], ...updatedBooking };
          this.bookings.set(updated);

          // Show toast if status changed
          if (oldStatus && newStatus && oldStatus !== newStatus) {
            const statusConfig = STATUS_CONFIG[newStatus];
            await this.showToast(
              `Booking ${statusConfig?.label || newStatus}`,
              statusConfig?.color || 'primary'
            );
          }
        } else {
          // New booking - reload full list to get related data
          await this.loadBookings();
          await this.showToast('New booking created', 'success');
        }
      }
    );
  }

  async handleRefresh(event: RefresherCustomEvent) {
    await this.loadBookings();
    event.target.complete();
  }

  onFilterChange(event: CustomEvent) {
    this.filterStatus.set(event.detail.value as FilterStatus);
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
