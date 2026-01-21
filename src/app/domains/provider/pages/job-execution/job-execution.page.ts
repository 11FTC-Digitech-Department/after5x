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
  arrowBack,
  chevronForward,
  playCircle,
  stopCircle,
  checkmarkDone,
  cardOutline,
  walletOutline
} from 'ionicons/icons';
import { Geolocation, Position, WatchPositionCallback } from '@capacitor/geolocation';

import { SessionService } from '@core/auth/session';
import { ProviderBookingService, ProviderBooking } from '@core/services/provider-booking.service';
import { RealTimeService } from '@core/services/real-time.service';
import { BookingStatus, BookingTimelineRow } from '@core/models/booking.model';

// Status display configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; message: string }> = {
  [BookingStatus.PENDING_ACCEPTANCE]: {
    label: 'Pending',
    color: 'warning',
    icon: 'hourglass',
    message: 'Review and accept this job request'
  },
  [BookingStatus.CONFIRMED]: {
    label: 'Confirmed',
    color: 'primary',
    icon: 'checkmark-circle',
    message: 'Start traveling when ready'
  },
  [BookingStatus.ON_THE_WAY]: {
    label: 'On The Way',
    color: 'tertiary',
    icon: 'car',
    message: 'Traveling to customer location'
  },
  [BookingStatus.ARRIVED]: {
    label: 'Arrived',
    color: 'tertiary',
    icon: 'location-outline',
    message: 'Ready to start work'
  },
  [BookingStatus.IN_PROGRESS]: {
    label: 'In Progress',
    color: 'secondary',
    icon: 'hammer',
    message: 'Service work in progress'
  },
  [BookingStatus.PAYMENT_PENDING]: {
    label: 'Awaiting Payment',
    color: 'warning',
    icon: 'card-outline',
    message: 'Customer is completing payment via app'
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
    message: 'Job completed successfully'
  },
  [BookingStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'danger',
    icon: 'close-circle',
    message: 'This job was cancelled'
  },
  [BookingStatus.REJECTED]: {
    label: 'Rejected',
    color: 'danger',
    icon: 'close-circle',
    message: 'You rejected this job'
  }
};

// Action configuration based on status
interface ActionConfig {
  label: string;
  icon: string;
  color: string;
  action: () => Promise<void>;
  secondaryLabel?: string;
  secondaryAction?: () => Promise<void>;
}

@Component({
  selector: 'app-job-execution',
  templateUrl: './job-execution.page.html',
  styleUrls: ['./job-execution.page.scss'],
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
export class JobExecutionPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private providerBookingService = inject(ProviderBookingService);
  private realTimeService = inject(RealTimeService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // State
  booking = signal<ProviderBooking | null>(null);
  isLoading = signal(true);
  isExecutingAction = signal(false);
  isTrackingLocation = signal(false);

  // GPS tracking
  private locationWatchId: string | null = null;

  // Real-time subscription
  private unsubscribeRealTime: (() => void) | null = null;

  // Computed
  statusConfig = computed(() => {
    const status = this.booking()?.status;
    return status ? STATUS_CONFIG[status] : null;
  });

  timeline = computed(() => {
    const entries = this.booking()?.booking_timeline || [];
    return [...entries].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  currentAction = computed((): ActionConfig | null => {
    const status = this.booking()?.status as BookingStatus;
    if (!status) return null;

    switch (status) {
      case BookingStatus.PENDING_ACCEPTANCE:
        return {
          label: 'Accept Job',
          icon: 'checkmark-circle',
          color: 'success',
          action: () => this.acceptJob(),
          secondaryLabel: 'Reject',
          secondaryAction: () => this.rejectJob()
        };
      case BookingStatus.CONFIRMED:
        return {
          label: 'Start Travel',
          icon: 'car',
          color: 'tertiary',
          action: () => this.startTravel()
        };
      case BookingStatus.ON_THE_WAY:
        return {
          label: 'Mark Arrived',
          icon: 'location-outline',
          color: 'tertiary',
          action: () => this.arriveAtLocation()
        };
      case BookingStatus.ARRIVED:
        return {
          label: 'Start Work',
          icon: 'play-circle',
          color: 'secondary',
          action: () => this.startWork()
        };
      case BookingStatus.IN_PROGRESS:
        return {
          label: 'Complete Work',
          icon: 'checkmark-done',
          color: 'success',
          action: () => this.completeWork()
        };
      default:
        return null;
    }
  });

  hasActionFooter = computed(() => {
    const status = this.booking()?.status as BookingStatus;
    return [
      BookingStatus.PENDING_ACCEPTANCE,
      BookingStatus.CONFIRMED,
      BookingStatus.ON_THE_WAY,
      BookingStatus.ARRIVED,
      BookingStatus.IN_PROGRESS
    ].includes(status);
  });

  // Check if waiting for payment
  isAwaitingPayment = computed(() => {
    const status = this.booking()?.status as BookingStatus;
    return status === BookingStatus.PAYMENT_PENDING;
  });

  // Check if payment is complete
  isPaid = computed(() => {
    const status = this.booking()?.status as BookingStatus;
    return status === BookingStatus.PAID || status === BookingStatus.COMPLETED;
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
      arrowBack,
      chevronForward,
      playCircle,
      stopCircle,
      checkmarkDone,
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

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
    // Stop location tracking when leaving page
    this.stopLocationTracking();
  }

  async loadBooking(bookingId: string) {
    this.isLoading.set(true);
    try {
      const booking = await this.providerBookingService.getBookingById(bookingId);
      if (booking) {
        this.booking.set(booking);
        // Resume location tracking if status is ON_THE_WAY
        if (booking.status === BookingStatus.ON_THE_WAY) {
          await this.startLocationTracking();
        }
      } else {
        await this.showToast('Job not found', 'danger');
        this.router.navigate(['/p/schedule']);
      }
    } catch (error) {
      console.error('Failed to load booking:', error);
      await this.showToast('Failed to load job details', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  private setupRealTimeSubscription(bookingId: string) {
    this.unsubscribeRealTime = this.realTimeService.subscribeToBooking(
      bookingId,
      {
        onBookingUpdate: (updatedBooking) => {
          const current = this.booking();
          if (current) {
            this.booking.set({ ...current, ...updatedBooking });
          }
        },
        onStatusChange: async (newStatus) => {
          const config = STATUS_CONFIG[newStatus];
          if (config) {
            await this.showToast(config.message, config.color);
          }
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

  async handleRefresh(event: RefresherCustomEvent) {
    const bookingId = this.booking()?.id;
    if (bookingId) {
      await this.loadBooking(bookingId);
    }
    event.target.complete();
  }

  // Action methods
  async acceptJob() {
    const booking = this.booking();
    if (!booking) return;

    this.isExecutingAction.set(true);
    try {
      await this.providerBookingService.acceptJob(booking.id);
      await this.showToast('Job accepted!', 'success');
      await this.loadBooking(booking.id);
    } catch (error) {
      console.error('Failed to accept job:', error);
      await this.showToast('Failed to accept job', 'danger');
    } finally {
      this.isExecutingAction.set(false);
    }
  }

  async rejectJob() {
    const booking = this.booking();
    if (!booking) return;

    const alert = await this.alertController.create({
      header: 'Reject Job',
      message: 'Are you sure you want to reject this job?',
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Reason for rejection (optional)'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Reject',
          role: 'destructive',
          handler: async (data) => {
            this.isExecutingAction.set(true);
            try {
              await this.providerBookingService.rejectJob(booking.id, data.reason || 'Provider rejected');
              await this.showToast('Job rejected', 'warning');
              this.router.navigate(['/p/schedule']);
            } catch (error) {
              console.error('Failed to reject job:', error);
              await this.showToast('Failed to reject job', 'danger');
            } finally {
              this.isExecutingAction.set(false);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async startTravel() {
    const booking = this.booking();
    if (!booking) return;

    this.isExecutingAction.set(true);
    try {
      await this.providerBookingService.startTravel(booking.id);
      await this.startLocationTracking();
      await this.showToast('Travel started. GPS tracking enabled.', 'tertiary');
      await this.loadBooking(booking.id);
    } catch (error) {
      console.error('Failed to start travel:', error);
      await this.showToast('Failed to start travel', 'danger');
    } finally {
      this.isExecutingAction.set(false);
    }
  }

  async arriveAtLocation() {
    const booking = this.booking();
    if (!booking) return;

    this.isExecutingAction.set(true);
    try {
      await this.providerBookingService.arriveAtLocation(booking.id);
      await this.stopLocationTracking();
      await this.showToast('Marked as arrived', 'success');
      await this.loadBooking(booking.id);
    } catch (error) {
      console.error('Failed to mark arrived:', error);
      await this.showToast('Failed to mark arrived', 'danger');
    } finally {
      this.isExecutingAction.set(false);
    }
  }

  async startWork() {
    const booking = this.booking();
    if (!booking) return;

    this.isExecutingAction.set(true);
    try {
      await this.providerBookingService.startWork(booking.id);
      await this.showToast('Work started', 'secondary');
      await this.loadBooking(booking.id);
    } catch (error) {
      console.error('Failed to start work:', error);
      await this.showToast('Failed to start work', 'danger');
    } finally {
      this.isExecutingAction.set(false);
    }
  }

  async completeWork() {
    const booking = this.booking();
    if (!booking) return;

    const alert = await this.alertController.create({
      header: 'Complete Work',
      message: 'Confirm that you have completed all work for this job?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Complete',
          handler: async () => {
            this.isExecutingAction.set(true);
            try {
              await this.providerBookingService.completeWork(booking.id);
              await this.showToast('Work completed! Awaiting payment.', 'success');
              await this.loadBooking(booking.id);
            } catch (error) {
              console.error('Failed to complete work:', error);
              await this.showToast('Failed to complete work', 'danger');
            } finally {
              this.isExecutingAction.set(false);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // GPS Location Tracking
  private async startLocationTracking() {
    const booking = this.booking();
    const profile = this.sessionService.profile();
    // For providers, their user ID is their provider ID
    const providerId = profile?.role === 'provider' ? profile.id : null;

    if (!booking || !providerId) return;

    try {
      // Check permissions
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== 'granted') {
          await this.showToast('Location permission required for tracking', 'warning');
          return;
        }
      }

      this.isTrackingLocation.set(true);

      // Start watching position
      this.locationWatchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        },
        async (position: Position | null, err?: any) => {
          if (err) {
            console.error('Location watch error:', err);
            return;
          }

          if (position && booking) {
            try {
              await this.realTimeService.broadcastProviderLocation(
                booking.id,
                providerId,
                {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                },
                {
                  heading: position.coords.heading ?? undefined,
                  speedKmh: position.coords.speed ? position.coords.speed * 3.6 : undefined
                }
              );
            } catch (error) {
              console.error('Failed to broadcast location:', error);
            }
          }
        }
      );

      console.log('Location tracking started, watchId:', this.locationWatchId);
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      await this.showToast('Failed to start GPS tracking', 'warning');
    }
  }

  private async stopLocationTracking() {
    if (this.locationWatchId) {
      try {
        await Geolocation.clearWatch({ id: this.locationWatchId });
        console.log('Location tracking stopped');
      } catch (error) {
        console.error('Failed to stop location tracking:', error);
      }
      this.locationWatchId = null;
    }
    this.isTrackingLocation.set(false);
  }

  // Contact methods
  callCustomer() {
    const phone = (this.booking() as any)?.customers?.profiles?.phone_number;
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }

  openNavigation() {
    const address = this.booking()?.address_snapshot?.address;
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      // Open in Google Maps
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
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
    if (iconUrl) {
      const iconName = iconUrl.split('/').pop()?.replace('.png', '') || 'construct';
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

  getCustomerName(): string {
    return (this.booking() as any)?.customers?.profiles?.full_name || 'Customer';
  }

  getCustomerAvatar(): string | null {
    return (this.booking() as any)?.customers?.profiles?.avatar_url || null;
  }

  getCustomerPhone(): string | null {
    return (this.booking() as any)?.customers?.profiles?.phone_number || null;
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
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
