import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonList, IonItem, IonLabel, IonBadge,
  IonSpinner, IonIcon,
  IonAccordionGroup, IonAccordion,
  IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  layersOutline, pricetagOutline, checkmarkCircle, closeCircle
} from 'ionicons/icons';
import { AdminService } from '../../../../core/services/admin.service';
import { devError } from '../../../../core/utils/logger';

@Component({
  selector: 'app-services',
  templateUrl: './services.page.html',
  styleUrls: ['./services.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonList, IonItem, IonLabel, IonBadge,
    IonSpinner, IonIcon,
    IonAccordionGroup, IonAccordion,
    IonRefresher, IonRefresherContent,
    CommonModule
  ]
})
export class ServicesPage implements OnInit {
  private adminService = inject(AdminService);

  categories = signal<any[]>([]);
  loading = signal(true);

  constructor() {
    addIcons({ layersOutline, pricetagOutline, checkmarkCircle, closeCircle });
  }

  async ngOnInit() {
    await this.loadCatalog();
  }

  async loadCatalog() {
    this.loading.set(true);
    try {
      const data = await this.adminService.getServiceCatalog();
      this.categories.set(data);
    } catch (err) {
      devError('Failed to load service catalog:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async handleRefresh(event: any) {
    await this.loadCatalog();
    event.target.complete();
  }

  formatPrice(amount: number): string {
    return this.adminService.formatCurrency(amount);
  }

  getActiveCount(items: any[]): number {
    return items?.filter((i: any) => i.is_active).length ?? 0;
  }
}
