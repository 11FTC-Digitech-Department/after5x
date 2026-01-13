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
  IonAvatar
} from '@ionic/angular/standalone';
import { ServiceService, ServiceWithProvider, ProviderService } from '@core/services/service.service';

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
    CommonModule,
    FormsModule
  ]
})
export class ServiceDetailsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serviceService = inject(ServiceService);

  serviceVariantId = signal<string>('');
  serviceData = signal<ServiceWithProvider | null>(null);
  providerServices = signal<ProviderService[]>([]);
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
    const provider = this.serviceData()?.provider;
    if (!provider) return 0;
    return provider.rating_avg || 0;
  });

  providerName = computed(() => {
    const provider = this.serviceData()?.provider;
    if (!provider?.profile) return '';
    return provider.profile.full_name || '';
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
      const serviceData = await this.serviceService.getServiceWithProvider(serviceVariantId);

      if (serviceData) {
        this.serviceData.set(serviceData);

        // Load other services by this provider
        try {
          const [otherServices, reviews] = await Promise.all([
            this.serviceService.getProviderOtherServices(
              serviceData.provider.id,
              serviceVariantId
            ),
            this.serviceService.getProviderReviews(serviceData.provider.id)
          ]);
          this.providerServices.set(otherServices || []);
          this.providerReviews.set(reviews || []);
        } catch (error) {
          console.error('Error loading provider data:', error);
          this.providerServices.set([]);
          this.providerReviews.set([]);
        }
      }
    } catch (error) {
      console.error('Error loading service data:', error);
    } finally {
      this.isLoading.set(false);
    }
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
    if (serviceId) {
      this.router.navigate(['/c/book', serviceId]);
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
    console.log('Adding review:', { rating, comment, providerId: this.serviceData()?.provider?.id });
    // TODO: Implement review form and submission
  }
}
