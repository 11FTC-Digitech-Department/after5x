import { Component, OnInit, inject, signal } from '@angular/core';
import { devError } from '../../../../core/utils/logger';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonGrid,
  IonRow,
  IonCol,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  IonBadge,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { optionsOutline, chevronForward, star, constructOutline, checkmarkCircle } from 'ionicons/icons';
import { ServiceService, ServiceGroup, ServiceVariant } from '@core/services/service.service';
import { AuthGuard } from '@core/auth/auth.guard';
import { VariantSelectorComponent, VariantSelectionResult } from '@shared/components/variant-selector/variant-selector.component';

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  icon_url?: string;
}

@Component({
  selector: 'app-catalog',
  templateUrl: './catalog.page.html',
  styleUrls: ['./catalog.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonGrid,
    IonRow,
    IonCol,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonIcon,
    IonBadge,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    CommonModule,
    FormsModule,
    VariantSelectorComponent
  ]
})
export class CatalogPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serviceService = inject(ServiceService);
  private authGuard = inject(AuthGuard);
  private modalController = inject(ModalController);

  categorySlug = signal<string>('');
  categoryInfo = signal<CategoryInfo | null>(null);
  serviceGroups = signal<ServiceGroup[]>([]);
  isLoading = signal(true);

  // Track expanded service for inline variant selection
  expandedServiceId = signal<string | null>(null);
  selectedVariantResult = signal<VariantSelectionResult | null>(null);

  constructor() {
    addIcons({ optionsOutline, chevronForward, star, constructOutline, checkmarkCircle });
  }

  async ngOnInit() {
    // Ensure authentication before loading data
    const isAuthenticated = await this.authGuard.requireAuthentication();
    if (!isAuthenticated) {
      return; // Auth guard will handle navigation
    }

    const categorySlug = this.route.snapshot.paramMap.get('catId');
    if (categorySlug) {
      this.categorySlug.set(categorySlug);
      await this.loadCategoryData(categorySlug);
    }
  }

  async loadCategoryData(categorySlug: string) {
    this.isLoading.set(true);
    this.expandedServiceId.set(null);
    this.selectedVariantResult.set(null);

    try {
      const groups = await this.serviceService.getGroupedServicesByCategory(categorySlug);

      if (groups && groups.length > 0) {
        // Extract category info from first service
        const firstService = groups[0].service as any;
        this.categoryInfo.set({
          id: firstService.category_id,
          name: firstService.service_categories?.name,
          slug: categorySlug,
          icon_url: firstService.service_categories?.icon_url
        });

        this.serviceGroups.set(groups);
      }
    } catch (error) {
      devError('Error loading category data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectService(group: ServiceGroup) {
    if (!group.hasMultipleVariants) {
      // Single variant - navigate directly to service details
      this.navigateToService(group.variants[0].id);
    } else {
      // Multiple variants - require explicit selection before navigation
      const currentExpanded = this.expandedServiceId();
      if (currentExpanded === group.service.id) {
        this.expandedServiceId.set(null);
        this.selectedVariantResult.set(null);
      } else {
        this.expandedServiceId.set(group.service.id);
        this.selectedVariantResult.set(null);
      }
    }
  }

  onVariantSelected(result: VariantSelectionResult | null) {
    this.selectedVariantResult.set(result);
  }

  onFallbackVariantSelected(group: ServiceGroup, selectedVariantId: string) {
    const selectedVariant = group.variants.find(variant => variant.id === selectedVariantId) || null;
    if (!selectedVariant) {
      this.selectedVariantResult.set(null);
      return;
    }

    this.selectedVariantResult.set({
      variant: selectedVariant,
      selections: {}
    });
  }

  proceedWithVariant() {
    const result = this.selectedVariantResult();
    if (result) {
      this.navigateToService(result.variant.id);
    }
  }

  navigateToService(serviceVariantId: string) {
    this.router.navigate(['/c/service-details', serviceVariantId]);
  }

  formatPriceRange(min: number, max: number): string {
    if (min === max) {
      return `₱${min.toLocaleString()}`;
    }
    return `₱${min.toLocaleString()} - ₱${max.toLocaleString()}`;
  }

  async doRefresh(event: any) {
    const categorySlug = this.categorySlug();
    if (categorySlug) {
      await this.loadCategoryData(categorySlug);
    }
    event.target.complete();
  }

  isExpanded(serviceId: string): boolean {
    return this.expandedServiceId() === serviceId;
  }

  getGroupVariants(group: ServiceGroup): ServiceVariant[] {
    return group.variants;
  }

  getFallbackSelectedId(group: ServiceGroup): string | undefined {
    const result = this.selectedVariantResult();
    if (!result) return undefined;
    const inGroup = group.variants.some(v => v.id === result!.variant.id);
    return inGroup ? result.variant.id : undefined;
  }

  getFallbackDisplayMin(v: ServiceVariant): number {
    const gas = v.properties?.['gas_amount_fee'];
    if (typeof gas === 'number') return gas;
    return v.price_min;
  }

  getFallbackDisplayMax(v: ServiceVariant): number {
    const gas = v.properties?.['gas_amount_fee'];
    if (typeof gas === 'number') return gas;
    return v.price_max;
  }

  getFallbackPriceLabel(v: ServiceVariant): string {
    if (v.properties?.['gas_amount_fee'] != null) return 'Price';
    return 'Standard Price';
  }

  getFallbackAfter5Min(v: ServiceVariant): number {
    const gas = v.properties?.['gas_amount_fee'];
    if (typeof gas === 'number') return gas;
    return v.price_after5_min ?? v.price_min;
  }

  getFallbackAfter5Max(v: ServiceVariant): number {
    const gas = v.properties?.['gas_amount_fee'];
    if (typeof gas === 'number') return gas;
    return v.price_after5_max ?? v.price_max;
  }

  hasFallbackDistinctAfter5Price(v: ServiceVariant): boolean {
    if (v.properties?.['gas_amount_fee'] != null) return false;
    const after5Min = v.price_after5_min ?? v.price_min;
    const after5Max = v.price_after5_max ?? v.price_max;
    return after5Min !== v.price_min || after5Max !== v.price_max;
  }

  hasDistinctAfter5Price(group: ServiceGroup): boolean {
    // Omit after 5PM badge for Fuel Delivery (gas_amount_fee) - same price both tiers
    const allHaveGasAmount = group.variants.every(v => v.properties?.['gas_amount_fee'] != null);
    if (allHaveGasAmount) return false;
    const { priceRange, priceAfter5Range } = group;
    return priceAfter5Range.min !== priceRange.min || priceAfter5Range.max !== priceRange.max;
  }
}
