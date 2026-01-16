import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonBackButton,
  IonButtons,
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonCardTitle,
  IonCardSubtitle,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonFooter,
  IonSkeletonText,
  IonList,
  IonItem,
  IonChip,
  IonAvatar,
  IonBadge
} from '@ionic/angular/standalone';
import { ServiceService, ServiceWithProviders, ProviderOffering, ProviderService } from '@core/services/service.service';

@Component({
  selector: 'app-service-details',
  templateUrl: './service-details.page.html',
  styleUrls: ['./service-details.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonBackButton,
    IonButtons,
    IonButton,
    IonIcon,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardContent,
    IonCardTitle,
    IonCardSubtitle,
    IonText,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonFooter,
    IonSkeletonText,
    IonList,
    IonItem,
    IonChip,
    IonAvatar,
    IonBadge,
    CommonModule,
    FormsModule
  ]
})
export class ServiceDetailsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serviceService = inject(ServiceService);

  serviceVariantId = signal<string>('');
  serviceData = signal<ServiceWithProviders | null>(null);
  providerServices = signal<ProviderService[]>([]);
  availableProviders = signal<ProviderOffering[]>([]);
  selectedProvider = signal<ProviderOffering | null>(null);
  selectedSegment = signal<'services' | 'provider' | 'reviews'>('services');
  isLoading = signal(true);
  isFavorite = signal(false);
  providerReviews = signal<any[]>([]);

  // Computed signals
  serviceTitle = computed(() => this.serviceData()?.name || '');
  servicePrice = computed(() => {
    const data = this.serviceData();
    if (!data) return '';
    return `₱${data.price_min} - ₱${data.price_max}`;
  });

  serviceDuration = computed(() => {
    const data = this.serviceData();
    if (!data) return '';
    return `${data.duration_minutes} minutes`;
  });

  providerRating = computed(() => {
    const provider = this.selectedProvider();
    if (!provider) return 0;
    return provider.rating || 0;
  });

  providerName = computed(() => {
    const provider = this.selectedProvider();
    if (!provider) return '';
    return provider.providerName || '';
  });

  constructor() { }

  async ngOnInit() {
    const serviceVariantId = this.route.snapshot.paramMap.get('serviceVariantId');
    if (serviceVariantId) {
      this.serviceVariantId.set(serviceVariantId);
      await this.loadServiceData(serviceVariantId);
    }
  }

  async loadServiceData(serviceVariantId: string) {
    this.isLoading.set(true);
    try {
      const serviceData = await this.serviceService.getServiceWithAllProviders(serviceVariantId);

      if (serviceData) {
        this.serviceData.set(serviceData);
        this.availableProviders.set(serviceData.providers);
        this.selectedProvider.set(serviceData.selectedProvider);

        // Load other services and reviews for the default (selected) provider
        await this.loadProviderData(serviceData.selectedProvider.providerId, serviceVariantId);
      }
    } catch (error) {
      console.error('Error loading service data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadProviderData(providerId: string, excludeServiceVariantId: string) {
    try {
      const [otherServices, reviews] = await Promise.all([
        this.serviceService.getProviderOtherServices(providerId, excludeServiceVariantId),
        this.serviceService.getProviderReviews(providerId)
      ]);
      this.providerServices.set(otherServices || []);
      this.providerReviews.set(reviews || []);
    } catch (error) {
      console.error('Error loading provider data:', error);
      this.providerServices.set([]);
      this.providerReviews.set([]);
    }
  }

  selectProvider(provider: ProviderOffering) {
    this.selectedProvider.set(provider);
    // Reload other services and reviews for the newly selected provider
    this.loadProviderData(provider.providerId, this.serviceVariantId());
  }

  onSegmentChange(event: any) {
    this.selectedSegment.set(event.detail.value);
  }

  toggleFavorite() {
    this.isFavorite.set(!this.isFavorite());
  }

  navigateToService(serviceId: string) {
    this.router.navigate(['/c/service-details', serviceId]);
  }

  bookNow() {
    const serviceId = this.serviceVariantId();
    const provider = this.selectedProvider();
    if (serviceId) {
      this.router.navigate(['/c/book', serviceId], {
        state: { preSelectedProviderId: provider?.providerId }
      });
    }
  }

  navigateToProvider() {
    // Navigate to provider profile or services
    // For now, just stay on the provider tab
    this.selectedSegment.set('provider');
  }

  async addReview(rating: number, comment: string) {
    // This would typically be called from a review form
    // For now, just log the action
    console.log('Adding review:', { rating, comment, providerId: this.selectedProvider()?.providerId });
    // TODO: Implement review form and submission
  }
}
