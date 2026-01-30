import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { formatDistanceToNow } from 'date-fns';
import { addIcons } from 'ionicons';
import { ellipse, peopleOutline } from 'ionicons/icons';
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
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { ServiceService, ServiceWithProviders, ProviderOffering, ProviderService } from '@core/services/service.service';
import { RealTimeService } from '@core/services/real-time.service';

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
    IonRefresher,
    IonRefresherContent,
    CommonModule,
    FormsModule
  ]
})
export class ServiceDetailsPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serviceService = inject(ServiceService);
  private realTimeService = inject(RealTimeService);

  // Real-time subscription cleanup
  private providerAvailabilityUnsubscribe: (() => void) | null = null;

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
    return provider.displayName || '';
  });

  constructor() {
    addIcons({ ellipse, peopleOutline });
  }

  ngOnDestroy() {
    // Clean up real-time subscription
    if (this.providerAvailabilityUnsubscribe) {
      this.providerAvailabilityUnsubscribe();
      this.providerAvailabilityUnsubscribe = null;
    }
  }

  /**
   * Get human-readable duration for how long provider has been online
   */
  getOnlineDuration(provider: ProviderOffering): string {
    if (!provider.onlineSince) return '';
    return formatDistanceToNow(provider.onlineSince, { addSuffix: false });
  }

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
        if (serviceData.selectedProvider) {
          await this.loadProviderData(serviceData.selectedProvider.providerId, serviceVariantId);
        }

        // Set up real-time subscription for provider availability changes
        this.setupProviderAvailabilitySubscription(serviceVariantId);
      }
    } catch (error) {
      console.error('Error loading service data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Set up real-time subscription for provider availability
   */
  private setupProviderAvailabilitySubscription(serviceVariantId: string) {
    // Clean up existing subscription
    if (this.providerAvailabilityUnsubscribe) {
      this.providerAvailabilityUnsubscribe();
    }

    // Subscribe to provider status changes
    this.providerAvailabilityUnsubscribe = this.realTimeService.subscribeToProviderAvailability(
      (providerId: string, status: string, onlineSince: Date | null) => {
        this.handleProviderStatusChange(providerId, status, onlineSince, serviceVariantId);
      }
    );
  }

  /**
   * Handle real-time provider status changes
   */
  private async handleProviderStatusChange(
    providerId: string,
    status: string,
    onlineSince: Date | null,
    serviceVariantId: string
  ) {
    const currentProviders = this.availableProviders();
    const isAvailableStatus = status === 'online' || status === 'busy';
    const providerInList = currentProviders.find(p => p.providerId === providerId);

    if (isAvailableStatus && !providerInList) {
      // Provider came online - refresh the full list to include them
      console.log('Provider came online, refreshing list:', providerId);
      const serviceData = await this.serviceService.getServiceWithAllProviders(serviceVariantId);
      if (serviceData) {
        this.availableProviders.set(serviceData.providers);
        // If no provider was selected and now we have providers, select the first one
        if (!this.selectedProvider() && serviceData.providers.length > 0) {
          this.selectedProvider.set(serviceData.providers[0]);
          await this.loadProviderData(serviceData.providers[0].providerId, serviceVariantId);
        }
      }
    } else if (!isAvailableStatus && providerInList) {
      // Provider went offline - remove from list
      console.log('Provider went offline, removing from list:', providerId);
      const filteredProviders = currentProviders.filter(p => p.providerId !== providerId);
      this.availableProviders.set(filteredProviders);

      // If the selected provider went offline, select another one
      if (this.selectedProvider()?.providerId === providerId) {
        if (filteredProviders.length > 0) {
          this.selectedProvider.set(filteredProviders[0]);
          await this.loadProviderData(filteredProviders[0].providerId, serviceVariantId);
        } else {
          this.selectedProvider.set(null);
          this.providerServices.set([]);
          this.providerReviews.set([]);
        }
      }
    } else if (isAvailableStatus && providerInList) {
      // Provider status or onlineSince updated - update in place
      const updatedProviders = currentProviders.map(p =>
        p.providerId === providerId
          ? { ...p, status, onlineSince: onlineSince || undefined }
          : p
      );
      this.availableProviders.set(updatedProviders);

      // Also update selectedProvider if it's the same one
      if (this.selectedProvider()?.providerId === providerId) {
        this.selectedProvider.set(updatedProviders.find(p => p.providerId === providerId) || null);
      }
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

  /**
   * Handle pull-to-refresh to reload provider list
   */
  async doRefresh(event: RefresherCustomEvent) {
    try {
      const serviceVariantId = this.serviceVariantId();
      if (serviceVariantId) {
        const serviceData = await this.serviceService.getServiceWithAllProviders(serviceVariantId);
        if (serviceData) {
          this.availableProviders.set(serviceData.providers);

          // Update selected provider if current one is no longer available
          const currentSelected = this.selectedProvider();
          if (currentSelected) {
            const stillAvailable = serviceData.providers.find(p => p.providerId === currentSelected.providerId);
            if (!stillAvailable && serviceData.providers.length > 0) {
              this.selectedProvider.set(serviceData.providers[0]);
              await this.loadProviderData(serviceData.providers[0].providerId, serviceVariantId);
            } else if (stillAvailable) {
              // Update with fresh data
              this.selectedProvider.set(stillAvailable);
            }
          } else if (serviceData.providers.length > 0) {
            // No provider selected, select the first one
            this.selectedProvider.set(serviceData.providers[0]);
            await this.loadProviderData(serviceData.providers[0].providerId, serviceVariantId);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing provider list:', error);
    } finally {
      event.target.complete();
    }
  }
}
