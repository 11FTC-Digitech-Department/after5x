import { Component, OnInit, inject, signal } from '@angular/core';
import { devError } from '../../../../core/utils/logger';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonSkeletonText
} from '@ionic/angular/standalone';
import { ServiceService } from '@core/services/service.service';
import { AuthGuard } from '@core/auth/auth.guard';
import { Database } from '@core/supabase/database.types';

type ServiceCategoryRow = Database['public']['Tables']['service_categories']['Row'];

interface ExtendedCategory extends ServiceCategoryRow {
  description: string;
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  locksmithing: 'Emergency and scheduled locksmith services for homes, offices, and vehicles.',
  aircon: 'Air conditioning installation, cleaning, and repair to keep your space comfortable.',
  electrical: 'Safe and reliable electrical troubleshooting, installation, and maintenance.',
  automotive: 'On-demand roadside assistance including jumpstart, towing, fuel delivery, and basic repairs.',
  plumbing: 'Leak repairs, pipe installation, and full-service plumbing solutions.',
};

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSkeletonText,
    IonText,
    CommonModule,
  ]
})
export class CategoriesPage implements OnInit {
  private serviceService = inject(ServiceService);
  private router = inject(Router);
  private authGuard = inject(AuthGuard);

  categories = signal<ExtendedCategory[]>([]);
  isLoading = signal(true);
  loadError = signal<string | null>(null);

  async ngOnInit() {
    const isAuthenticated = await this.authGuard.requireAuthentication();
    if (!isAuthenticated) {
      return;
    }

    await this.loadCategories();
  }

  async loadCategories() {
    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      const data = await this.serviceService.getServiceCategories();

      if (Array.isArray(data)) {
        const extended = data.map((category: ServiceCategoryRow) => ({
          ...category,
          description: this.getCategoryDescription(category),
        }));
        this.categories.set(extended);
      } else {
        this.categories.set([]);
      }
    } catch (error) {
      devError('Error loading service categories:', error);
      this.loadError.set('Failed to load services. Please try again later.');
    } finally {
      this.isLoading.set(false);
    }
  }

  navigateToCategory(category: ServiceCategoryRow) {
    this.router.navigate(['/c/catalog', category.slug]);
  }

  private getCategoryDescription(category: ServiceCategoryRow): string {
    if (category.slug && CATEGORY_DESCRIPTIONS[category.slug]) {
      return CATEGORY_DESCRIPTIONS[category.slug];
    }

    return `${category.name} services from trusted professionals.`;
  }
}

