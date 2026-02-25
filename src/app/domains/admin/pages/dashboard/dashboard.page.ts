import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonNote,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  businessOutline,
  calendarOutline,
  timeOutline,
} from 'ionicons/icons';
import { AdminService, AdminStats, AdminBooking } from '../../../../core/services/admin.service';
import { StatsCardComponent } from '../../../../shared/components/stats-card/stats-card.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonNote,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    StatsCardComponent,
  ],
})
export class DashboardPage implements OnInit {
  private adminService = inject(AdminService);
  private router = inject(Router);

  stats = signal<AdminStats | null>(null);
  isLoading = signal(false);
  dashboardBookings = signal<AdminBooking[]>([]);
  isBookingsLoading = signal(false);

  sortedBookingsByStatus = computed(() => {
    const s = this.stats();
    if (!s || !s.bookingsByStatus.length) return [];
    return [...s.bookingsByStatus].sort((a, b) => b.count - a.count);
  });

  constructor() {
    addIcons({ peopleOutline, businessOutline, calendarOutline, timeOutline });
  }

  ngOnInit() {
    this.loadAll();
  }

  async loadAll() {
    await Promise.all([this.loadStats(), this.loadDashboardBookings()]);
  }

  async loadStats() {
    this.isLoading.set(true);
    try {
      const data = await this.adminService.getDashboardStats();
      this.stats.set(data);
    } catch (e) {
      console.error('Failed to load admin stats:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadDashboardBookings() {
    this.isBookingsLoading.set(true);
    try {
      const data = await this.adminService.getDashboardBookings();
      this.dashboardBookings.set(data);
    } catch (e) {
      console.error('Failed to load dashboard bookings:', e);
    } finally {
      this.isBookingsLoading.set(false);
    }
  }

  async onRefresh(event: Event) {
    const target = event.target as unknown as { complete: () => void };
    await this.loadAll();
    target.complete();
  }

  goToUsers() {
    this.router.navigate(['/a/users']);
  }

  goToProviders() {
    this.router.navigate(['/a/providers']);
  }

  goToBookings() {
    this.router.navigate(['/a/bookings']);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'success';
      case 'cancelled':
      case 'rejected':
      case 'expired':
        return 'danger';
      case 'in_progress':
      case 'on_the_way':
      case 'arrived':
        return 'primary';
      case 'confirmed':
        return 'secondary';
      case 'pending_acceptance':
      case 'finding_provider':
        return 'warning';
      case 'paid':
      case 'payment_pending':
        return 'tertiary';
      default:
        return 'medium';
    }
  }
}
