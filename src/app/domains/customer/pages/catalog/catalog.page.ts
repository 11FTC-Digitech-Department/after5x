import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonCardTitle,
  IonCardSubtitle,
  IonChip,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonAvatar,
  IonText,
  IonIcon
} from '@ionic/angular/standalone';
import { ServiceService, ServiceVariant, Service } from '@core/services/service.service';

interface CategoryWithServices {
  id: string;
  name: string;
  slug: string;
  icon_url?: string;
  services: any[];
  serviceVariants: any[];
}

@Component({
  selector: 'app-catalog',
  templateUrl: './catalog.page.html',
  styleUrls: ['./catalog.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardContent,
    IonCardTitle,
    IonCardSubtitle,
    IonChip,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonAvatar,
    IonText,
    IonIcon,
    CommonModule,
    FormsModule
  ]
})
export class CatalogPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serviceService = inject(ServiceService);

  categorySlug = signal<string>('');
  categoryData = signal<CategoryWithServices | null>(null);
  isLoading = signal(true);

  async ngOnInit() {
    const categorySlug = this.route.snapshot.paramMap.get('catId');
    if (categorySlug) {
      this.categorySlug.set(categorySlug);
      await this.loadCategoryData(categorySlug);
    }
  }

  async loadCategoryData(categorySlug: string) {
    this.isLoading.set(true);
    try {
      const services = await this.serviceService.getServicesByCategory(categorySlug);

      if (services && services.length > 0) {
        // Group services by category
        const category = services[0] as any; // Assuming all have same category

        // Flatten service variants from all services
        const serviceVariants = services.reduce((acc: any[], service: any) => {
          return acc.concat(
            service.service_variants.map((variant: any) => ({
              ...variant,
              service: service // Include service info
            }))
          );
        }, []);

        this.categoryData.set({
          id: category.category_id,
          name: category.service_categories?.name,
          slug: categorySlug,
          icon_url: category.service_categories?.icon_url,
          services: services,
          serviceVariants: serviceVariants
        });
      }
    } catch (error) {
      console.error('Error loading category data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  navigateToService(serviceVariantId: string) {
    this.router.navigate(['/c/service-details', serviceVariantId]);
  }

  async doRefresh(event: any) {
    const categorySlug = this.categorySlug();
    if (categorySlug) {
      await this.loadCategoryData(categorySlug);
    }
    event.target.complete();
  }
}
