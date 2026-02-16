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
import {
  ServiceService,
  ServiceWithProviders,
  ProviderOffering,
  ProviderService,
  Review
} from '@core/services/service.service';
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

  private providerAvailabilityUnsubscribe: (() => void) | null = null;
  private baseRequestToken = 0;
  private providerServicesRequestToken = 0;
  private reviewsRequestToken = 0;

  serviceVariantId = signal<string>('');
  serviceData = signal<ServiceWithProviders | null>(null);
  providerServices = signal<ProviderService[]>([]);
  availableProviders = signal<ProviderOffering[]>([]);
  selectedProvider = signal<ProviderOffering | null>(null);
  selectedSegment = signal<'services' | 'provider' | 'reviews'>('services');
  isFavorite = signal(false);
  providerReviews = signal<Review[]>([]);

  isBaseLoading = signal(true);
  isProviderServicesLoading = signal(false);
  isReviewsLoading = signal(false);

  baseLoadError = signal<string | null>(null);
  providerServicesError = signal<string | null>(null);
  reviewsError = signal<string | null>(null);

  loadedProviderServicesForProviderId = signal<string | null>(null);
  loadedReviewsForProviderId = signal<string | null>(null);

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

  providerName = computed(() => {
    const provider = this.selectedProvider();
    if (!provider) return '';
    return provider.displayName || '';
  });

  constructor() {
    addIcons({ ellipse, peopleOutline });
  }

  ngOnDestroy() {
    if (this.providerAvailabilityUnsubscribe) {
      this.providerAvailabilityUnsubscribe();
      this.providerAvailabilityUnsubscribe = null;
    }
  }

  getOnlineDuration(provider: ProviderOffering): string {
    if (!provider.onlineSince) return '';
    return formatDistanceToNow(provider.onlineSince, { addSuffix: false });
  }

  async ngOnInit() {
    const serviceVariantId = this.route.snapshot.paramMap.get('serviceVariantId');
    if (!serviceVariantId) return;

    this.serviceVariantId.set(serviceVariantId);
    this.setupProviderAvailabilitySubscription(serviceVariantId);
    await this.loadServiceData(serviceVariantId);
  }

  private applyServiceData(serviceData: ServiceWithProviders): void {
    this.serviceData.set(serviceData);
    this.availableProviders.set(serviceData.providers);

    const currentSelectedId = this.selectedProvider()?.providerId;
    const selectedFromList = currentSelectedId
      ? serviceData.providers.find(p => p.providerId === currentSelectedId) || null
      : null;

    const nextSelected = selectedFromList || serviceData.selectedProvider || serviceData.providers[0] || null;
    this.selectedProvider.set(nextSelected);

    if (!nextSelected) {
      this.providerServices.set([]);
      this.providerReviews.set([]);
      this.loadedProviderServicesForProviderId.set(null);
      this.loadedReviewsForProviderId.set(null);
      this.isProviderServicesLoading.set(false);
      this.isReviewsLoading.set(false);
      this.providerServicesError.set(null);
      this.reviewsError.set(null);
    }
  }

  async loadServiceData(serviceVariantId: string, options?: { forceRefresh?: boolean }) {
    const forceRefresh = Boolean(options?.forceRefresh);
    const requestToken = ++this.baseRequestToken;

    this.isBaseLoading.set(true);
    this.baseLoadError.set(null);

    if (forceRefresh) {
      this.serviceService.invalidateServiceWithProvidersCache(serviceVariantId);
    }

    if (!forceRefresh) {
      const cached = this.serviceService.getCachedServiceWithAllProviders(serviceVariantId);
      if (cached) {
        this.applyServiceData(cached);
        this.isBaseLoading.set(false);

        const cachedSelectedProvider = this.selectedProvider();
        if (cachedSelectedProvider) {
          this.loadProviderServices(cachedSelectedProvider.providerId, serviceVariantId);
          if (this.selectedSegment() === 'reviews') {
            this.loadReviews(cachedSelectedProvider.providerId);
          }
        }
      }
    }

    try {
      const serviceData = await this.serviceService.getServiceWithAllProviders(serviceVariantId);
      if (requestToken !== this.baseRequestToken) return;

      if (!serviceData) {
        if (!this.serviceData()) {
          this.baseLoadError.set('Unable to load service details.');
        }
        return;
      }

      this.applyServiceData(serviceData);

      const selectedProvider = this.selectedProvider();
      if (selectedProvider) {
        this.loadProviderServices(selectedProvider.providerId, serviceVariantId);
        if (this.selectedSegment() === 'reviews') {
          this.loadReviews(selectedProvider.providerId);
        }
      }
    } catch (error) {
      console.error('Error loading service data:', error);
      if (requestToken === this.baseRequestToken && !this.serviceData()) {
        this.baseLoadError.set('Unable to load service details.');
      }
    } finally {
      if (requestToken === this.baseRequestToken) {
        this.isBaseLoading.set(false);
      }
    }
  }

  private async loadProviderServices(
    providerId: string,
    excludeServiceVariantId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<void> {
    const forceRefresh = Boolean(options?.forceRefresh);

    if (this.loadedProviderServicesForProviderId() === providerId && !forceRefresh) {
      return;
    }

    if (forceRefresh) {
      this.serviceService.invalidateProviderOtherServicesCache(providerId);
    }

    const cached = this.serviceService.getCachedProviderOtherServices(providerId, excludeServiceVariantId);
    if (cached && !forceRefresh) {
      this.providerServices.set(cached);
      this.loadedProviderServicesForProviderId.set(providerId);
      this.providerServicesError.set(null);
      this.isProviderServicesLoading.set(false);
    } else {
      this.isProviderServicesLoading.set(true);
    }

    const requestToken = ++this.providerServicesRequestToken;
    this.providerServicesError.set(null);

    try {
      const otherServices = await this.serviceService.getProviderOtherServices(providerId, excludeServiceVariantId);
      if (requestToken !== this.providerServicesRequestToken) return;

      this.providerServices.set(otherServices || []);
      this.loadedProviderServicesForProviderId.set(providerId);
    } catch (error) {
      console.error('Error loading provider services:', error);
      if (requestToken === this.providerServicesRequestToken) {
        this.providerServices.set([]);
        this.providerServicesError.set('Unable to load other services right now.');
      }
    } finally {
      if (requestToken === this.providerServicesRequestToken) {
        this.isProviderServicesLoading.set(false);
      }
    }
  }

  private async loadReviews(providerId: string, options?: { forceRefresh?: boolean }): Promise<void> {
    const forceRefresh = Boolean(options?.forceRefresh);

    if (this.loadedReviewsForProviderId() === providerId && !forceRefresh) {
      return;
    }

    if (forceRefresh) {
      this.serviceService.invalidateProviderReviewsCache(providerId);
    }

    const cached = this.serviceService.getCachedProviderReviews(providerId);
    if (cached && !forceRefresh) {
      this.providerReviews.set(cached);
      this.loadedReviewsForProviderId.set(providerId);
      this.reviewsError.set(null);
      this.isReviewsLoading.set(false);
    } else {
      this.isReviewsLoading.set(true);
    }

    const requestToken = ++this.reviewsRequestToken;
    this.reviewsError.set(null);

    try {
      const reviews = await this.serviceService.getProviderReviews(providerId);
      if (requestToken !== this.reviewsRequestToken) return;

      this.providerReviews.set(reviews || []);
      this.loadedReviewsForProviderId.set(providerId);
    } catch (error) {
      console.error('Error loading provider reviews:', error);
      if (requestToken === this.reviewsRequestToken) {
        this.providerReviews.set([]);
        this.reviewsError.set('Unable to load reviews right now.');
      }
    } finally {
      if (requestToken === this.reviewsRequestToken) {
        this.isReviewsLoading.set(false);
      }
    }
  }

  private setupProviderAvailabilitySubscription(serviceVariantId: string) {
    if (this.providerAvailabilityUnsubscribe) {
      this.providerAvailabilityUnsubscribe();
    }

    this.providerAvailabilityUnsubscribe = this.realTimeService.subscribeToProviderAvailability(
      (providerId: string, status: string, onlineSince: Date | null) => {
        this.handleProviderStatusChange(providerId, status, onlineSince, serviceVariantId);
      }
    );
  }

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
      const serviceData = await this.serviceService.getServiceWithAllProviders(serviceVariantId);
      if (!serviceData) return;

      this.applyServiceData(serviceData);
      const selectedProvider = this.selectedProvider();
      if (selectedProvider) {
        this.loadProviderServices(selectedProvider.providerId, serviceVariantId);
        if (this.selectedSegment() === 'reviews') {
          this.loadReviews(selectedProvider.providerId);
        }
      }
      return;
    }

    if (!isAvailableStatus && providerInList) {
      const filteredProviders = currentProviders.filter(p => p.providerId !== providerId);
      this.availableProviders.set(filteredProviders);

      if (this.selectedProvider()?.providerId === providerId) {
        const nextSelected = filteredProviders[0] || null;
        this.selectedProvider.set(nextSelected);

        if (nextSelected) {
          this.providerServices.set([]);
          this.providerReviews.set([]);
          this.loadedProviderServicesForProviderId.set(null);
          this.loadedReviewsForProviderId.set(null);
          this.loadProviderServices(nextSelected.providerId, serviceVariantId);
          if (this.selectedSegment() === 'reviews') {
            this.loadReviews(nextSelected.providerId);
          }
        } else {
          this.providerServices.set([]);
          this.providerReviews.set([]);
          this.loadedProviderServicesForProviderId.set(null);
          this.loadedReviewsForProviderId.set(null);
        }
      }
      return;
    }

    if (isAvailableStatus && providerInList) {
      const updatedProviders = currentProviders.map(p =>
        p.providerId === providerId
          ? { ...p, status, onlineSince: onlineSince || undefined }
          : p
      );
      this.availableProviders.set(updatedProviders);

      if (this.selectedProvider()?.providerId === providerId) {
        this.selectedProvider.set(updatedProviders.find(p => p.providerId === providerId) || null);
      }
    }
  }

  selectProvider(provider: ProviderOffering) {
    this.selectedProvider.set(provider);

    const serviceVariantId = this.serviceVariantId();
    if (!serviceVariantId) return;

    this.providerServices.set([]);
    this.loadedProviderServicesForProviderId.set(null);
    this.loadProviderServices(provider.providerId, serviceVariantId);

    if (this.selectedSegment() === 'reviews') {
      this.providerReviews.set([]);
      this.loadedReviewsForProviderId.set(null);
      this.loadReviews(provider.providerId);
    }
  }

  onSegmentChange(event: any) {
    const segment = event.detail.value as 'services' | 'provider' | 'reviews';
    this.selectedSegment.set(segment);

    if (segment === 'reviews') {
      const provider = this.selectedProvider();
      if (provider) {
        this.loadReviews(provider.providerId);
      }
    }
  }

  retryBaseLoad() {
    const serviceVariantId = this.serviceVariantId();
    if (!serviceVariantId) return;
    this.loadServiceData(serviceVariantId, { forceRefresh: true });
  }

  retryProviderServicesLoad() {
    const provider = this.selectedProvider();
    const serviceVariantId = this.serviceVariantId();
    if (!provider || !serviceVariantId) return;

    this.loadedProviderServicesForProviderId.set(null);
    this.loadProviderServices(provider.providerId, serviceVariantId, { forceRefresh: true });
  }

  retryReviewsLoad() {
    const provider = this.selectedProvider();
    if (!provider) return;

    this.loadedReviewsForProviderId.set(null);
    this.loadReviews(provider.providerId, { forceRefresh: true });
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
    this.selectedSegment.set('provider');
  }

  async addReview(rating: number, comment: string) {
    console.log('Adding review:', { rating, comment, providerId: this.selectedProvider()?.providerId });
  }

  async doRefresh(event: RefresherCustomEvent) {
    try {
      const serviceVariantId = this.serviceVariantId();
      const providerId = this.selectedProvider()?.providerId;

      if (!serviceVariantId) return;

      this.serviceService.invalidateServiceWithProvidersCache(serviceVariantId);
      if (providerId) {
        this.serviceService.invalidateProviderOtherServicesCache(providerId);
        this.serviceService.invalidateProviderReviewsCache(providerId);
      }

      this.loadedProviderServicesForProviderId.set(null);
      this.loadedReviewsForProviderId.set(null);

      await this.loadServiceData(serviceVariantId, { forceRefresh: true });
    } catch (error) {
      console.error('Error refreshing provider list:', error);
    } finally {
      event.target.complete();
    }
  }
}
