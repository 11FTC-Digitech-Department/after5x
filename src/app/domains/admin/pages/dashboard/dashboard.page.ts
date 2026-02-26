import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, businessOutline, statsChartOutline,
  cashOutline, checkmarkCircleOutline, alertCircleOutline,
  walletOutline
} from 'ionicons/icons';
import { AdminService, AdminStats } from '../../../../core/services/admin.service';
import { devError } from '../../../../core/utils/logger';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonGrid, IonRow, IonCol, IonIcon, IonSpinner,
    IonRefresher, IonRefresherContent, IonBadge,
    CommonModule
  ]
})
export class DashboardPage implements OnInit {
  private adminService = inject(AdminService);

  stats = signal<AdminStats | null>(null);
  financials = signal<{ totalRevenue: number; totalPlatformFees: number; totalProviderEarnings: number; bookingsByStatus: Record<string, number> } | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor() {
    addIcons({
      peopleOutline, businessOutline, statsChartOutline,
      cashOutline, checkmarkCircleOutline, alertCircleOutline,
      walletOutline
    });
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [stats, financials] = await Promise.all([
        this.adminService.getDashboardStats(),
        this.adminService.getFinancialSummary(),
      ]);
      this.stats.set(stats);
      this.financials.set(financials);
    } catch (err) {
      devError('Failed to load dashboard data:', err);
      this.error.set('Failed to load dashboard data');
    } finally {
      this.loading.set(false);
    }
  }

  async handleRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  formatCurrency(amount: number): string {
    return this.adminService.formatCurrency(amount);
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'paid': 'success',
      'confirmed': 'primary',
      'in_progress': 'secondary',
      'on_the_way': 'tertiary',
      'arrived': 'tertiary',
      'cancelled': 'danger',
      'rejected': 'danger',
      'expired': 'warning',
      'finding_provider': 'medium',
      'pending_acceptance': 'warning',
      'payment_pending': 'warning',
    };
    return colors[status] || 'medium';
  }
}
