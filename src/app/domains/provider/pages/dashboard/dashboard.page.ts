import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonIcon,
  IonButton,
  IonToggle,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  RefresherCustomEvent,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  timeOutline,
  locationOutline,
  personOutline,
  walletOutline,
  checkmarkCircle,
  closeCircle,
  hourglass,
  chevronForward,
  notificationsOutline,
  cashOutline,
  briefcaseOutline,
  todayOutline,
  trendingUpOutline,
  callOutline
} from 'ionicons/icons';

import { SessionService } from '@core/auth/session';
import { ProviderDashboardService, DashboardStats, UrgentNotice, CalendarJob } from '@core/services/provider-dashboard.service';
import { ProviderBookingService, ProviderBooking } from '@core/services/provider-booking.service';
import { RealTimeService } from '@core/services/real-time.service';
import { NotificationService } from '@core/services/notification.service';
import { BookingStatus } from '@core/models/booking.model';

import { StatsCardComponent } from '@shared/components/stats-card/stats-card.component';
import { NoticeCarouselComponent } from '@shared/components/notice-carousel/notice-carousel.component';
import { BookingCalendarComponent, CalendarViewType } from '@shared/components/booking-calendar/booking-calendar.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardContent,
    IonIcon,
    IonButton,
    IonToggle,
    IonRefresher,
    IonRefresherContent,
    IonBadge,
    StatsCardComponent,
    NoticeCarouselComponent,
    BookingCalendarComponent
  ]
})
export class DashboardPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private dashboardService = inject(ProviderDashboardService);
  private providerBookingService = inject(ProviderBookingService);
  private realTimeService = inject(RealTimeService);
  private notificationService = inject(NotificationService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // State
  providerId = signal<string | null>(null);
  providerName = signal<string>('Provider');
  isOnline = signal(true);
  isLoading = signal(true);
  isStatsLoading = signal(true);
  isTogglingStatus = signal(false);

  // Dashboard data
  stats = signal<DashboardStats>({
    pendingJobsCount: 0,
    activeJobsCount: 0,
    todayJobsCount: 0,
    todayEarnings: 0,
    weekEarnings: 0,
    acceptanceRate: 100,
    completionRate: 100
  });

  urgentNotices = signal<UrgentNotice[]>([]);
  pendingJobs = signal<ProviderBooking[]>([]);
  calendarJobs = signal<CalendarJob[]>([]);
  unreadNotificationCount = signal(0);

  // Real-time subscription
  private unsubscribeRealTime: (() => void) | null = null;
  private unsubscribeNotifications: (() => void) | null = null;
  private dataLoaded = signal(false);

  // Computed
  formattedTodayEarnings = computed(() =>
    this.formatCurrency(this.stats().todayEarnings)
  );

  formattedWeekEarnings = computed(() =>
    this.formatCurrency(this.stats().weekEarnings)
  );

  constructor() {
    addIcons({
      calendarOutline,
      timeOutline,
      locationOutline,
      personOutline,
      walletOutline,
      checkmarkCircle,
      closeCircle,
      hourglass,
      chevronForward,
      notificationsOutline,
      cashOutline,
      briefcaseOutline,
      todayOutline,
      trendingUpOutline,
      callOutline
    });

    // Reactive effect: load data when profile becomes available
    effect(() => {
      const profile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      if (profile?.id && profile?.role === 'provider' && !isLoading && !this.dataLoaded()) {
        this.providerId.set(profile.id);
        this.providerName.set(profile.full_name || 'Provider');
        this.loadDashboardData();
        this.setupRealTimeSubscriptions();
      }
    });
  }

  async ngOnInit() {
    const profile = this.sessionService.profile();
    if (profile?.id && profile?.role === 'provider') {
      this.providerId.set(profile.id);
      this.providerName.set(profile.full_name || 'Provider');
      await this.loadDashboardData();
      this.setupRealTimeSubscriptions();
    }
  }

  ngOnDestroy() {
    if (this.unsubscribeRealTime) {
      this.unsubscribeRealTime();
    }
    if (this.unsubscribeNotifications) {
      this.unsubscribeNotifications();
    }
  }

  async loadDashboardData() {
    const providerId = this.providerId();
    if (!providerId) return;

    this.dataLoaded.set(true);
    this.isLoading.set(true);
    this.isStatsLoading.set(true);

    try {
      // Load all data in parallel
      const [stats, status, notices, pending, notifications] = await Promise.all([
        this.dashboardService.getDashboardStats(providerId),
        this.dashboardService.getProviderStatus(providerId),
        this.dashboardService.getUrgentNotices(providerId),
        this.dashboardService.getPendingJobs(providerId),
        this.notificationService.getUserNotifications(50)
      ]);

      this.stats.set(stats);
      this.isOnline.set(status.isOnline);
      this.urgentNotices.set(notices);
      this.pendingJobs.set(pending);

      // Count unread notifications
      const unreadCount = notifications.filter((n: any) => !n.read).length;
      this.unreadNotificationCount.set(unreadCount);

      // Load initial calendar data (current week)
      await this.loadCalendarJobs();

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      await this.showToast('Failed to load dashboard', 'danger');
    } finally {
      this.isLoading.set(false);
      this.isStatsLoading.set(false);
    }
  }

  async loadCalendarJobs(start?: Date, end?: Date) {
    const providerId = this.providerId();
    if (!providerId) return;

    if (!start || !end) {
      // Default to current week
      const now = new Date();
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }

    try {
      const jobs = await this.dashboardService.getCalendarJobs(providerId, start, end);
      this.calendarJobs.set(jobs);
    } catch (error) {
      console.error('Failed to load calendar jobs:', error);
    }
  }

  private setupRealTimeSubscriptions() {
    const providerId = this.providerId();
    if (!providerId) return;

    // Subscribe to booking updates
    this.unsubscribeRealTime = this.realTimeService.subscribeToProviderBookings(
      providerId,
      async (booking, oldStatus, newStatus) => {
        await this.loadDashboardData();

        if (!oldStatus && newStatus === BookingStatus.PENDING_ACCEPTANCE) {
          await this.showToast('New job request received!', 'primary');
        }
      }
    );

    // Subscribe to notifications
    this.unsubscribeNotifications = this.realTimeService.subscribeToNotifications(
      providerId,
      (notification) => {
        this.unreadNotificationCount.update(count => count + 1);
      }
    );
  }

  async toggleOnlineStatus() {
    const providerId = this.providerId();
    if (!providerId) return;

    const newStatus = !this.isOnline();
    this.isTogglingStatus.set(true);

    try {
      const confirmed = await this.confirmAvailabilityChange(newStatus);
      if (!confirmed) return;

      await this.dashboardService.setProviderStatus(providerId, newStatus);
      this.isOnline.set(newStatus);
      await this.showToast(
        newStatus ? 'You are now online' : 'You are now offline',
        newStatus ? 'success' : 'medium'
      );
    } catch (error) {
      console.error('Failed to toggle status:', error);
      await this.showToast('Failed to update status', 'danger');
    } finally {
      this.isTogglingStatus.set(false);
    }
  }

  private async confirmAvailabilityChange(newStatus: boolean): Promise<boolean> {
    const alert = await this.alertController.create({
      header: newStatus ? 'Go online?' : 'Go offline?',
      message: newStatus
        ? 'You will start receiving new job requests.'
        : 'You will stop receiving new job requests. Existing jobs are not affected.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: newStatus ? 'Go online' : 'Go offline', role: 'confirm' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  async handleRefresh(event: RefresherCustomEvent) {
    this.dataLoaded.set(false);
    await this.loadDashboardData();
    event.target.complete();
  }

  // Notice handlers
  onNoticeClick(notice: UrgentNotice) {
    if (notice.bookingId) {
      this.router.navigate(['/p/job', notice.bookingId]);
    }
  }

  onNoticeDismiss(notice: UrgentNotice) {
    this.urgentNotices.update(notices =>
      notices.filter(n => n.id !== notice.id)
    );
  }

  // Calendar handlers
  onCalendarDateChange(event: { start: Date; end: Date }) {
    this.loadCalendarJobs(event.start, event.end);
  }

  onCalendarJobClick(job: CalendarJob) {
    this.router.navigate(['/p/job', job.id]);
  }

  // Job actions
  async acceptJob(job: ProviderBooking) {
    try {
      await this.providerBookingService.acceptJob(job.id);
      await this.showToast('Job accepted!', 'success');
      await this.loadDashboardData();
    } catch (error) {
      console.error('Failed to accept job:', error);
      await this.showToast('Failed to accept job', 'danger');
    }
  }

  async rejectJob(job: ProviderBooking) {
    const alert = await this.alertController.create({
      header: 'Reject Job',
      message: 'Please provide a reason for rejecting this job.',
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Reason for rejection...'
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
            if (!data.reason?.trim()) {
              await this.showToast('Please provide a reason', 'warning');
              return false;
            }

            try {
              await this.providerBookingService.rejectJob(job.id, data.reason);
              await this.showToast('Job rejected', 'medium');
              await this.loadDashboardData();
              return true;
            } catch (error) {
              console.error('Failed to reject job:', error);
              await this.showToast('Failed to reject job', 'danger');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  openJob(job: ProviderBooking) {
    this.router.navigate(['/p/job', job.id]);
  }

  goToSchedule() {
    this.router.navigate(['/p/schedule']);
  }

  goToNotifications() {
    this.router.navigate(['/p/notifications']);
  }

  // Helper methods
  getServiceName(booking: ProviderBooking): string {
    const item = booking.booking_items?.[0];
    return item?.service_variants?.services?.name || item?.variant_name || 'Service';
  }

  getCustomerName(booking: ProviderBooking): string {
    return (booking as any).customers?.profiles?.full_name || 'Customer';
  }

  getCustomerPhone(booking: ProviderBooking): string | null {
    return (booking as any).customers?.profiles?.phone_number || null;
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

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${timeStr}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
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
    return this.formatCurrency(amount);
  }

  private formatCurrency(amount: number): string {
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

  async callCustomer(phone: string | null, event: Event) {
    event.stopPropagation();
    if (phone) {
      window.open(`tel:${phone}`, '_system');
    }
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
