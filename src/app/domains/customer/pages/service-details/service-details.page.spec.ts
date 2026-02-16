import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { ServiceDetailsPage } from './service-details.page';
import { ServiceService, ServiceWithProviders } from '@core/services/service.service';
import { RealTimeService } from '@core/services/real-time.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createServiceData(overrides?: Partial<ServiceWithProviders>): ServiceWithProviders {
  const defaultProvider = {
    id: 'off-1',
    providerId: 'p1',
    providerName: 'Provider One',
    displayName: 'After5 Expert - One',
    avatarUrl: '',
    rating: 4.8,
    reviewCount: 20,
    yearsExperience: 5,
    serviceRadius: 10,
    status: 'online',
    isDefault: true
  };

  return {
    id: 'sv1',
    service_id: 's1',
    name: 'AC Cleaning',
    description: 'Desc',
    price_min: 100,
    price_max: 200,
    price_after5_min: 120,
    price_after5_max: 240,
    vat_rate: 0,
    transportation_fee: null,
    commission_rate: 0,
    duration_minutes: 60,
    is_active: true,
    created_at: '',
    updated_at: '',
    service: {
      id: 's1',
      category_id: 'c1',
      name: 'Aircon',
      description: 'Service description',
      booking_form_schema: [],
      is_active: true,
      created_at: '',
      updated_at: '',
    },
    providers: [defaultProvider],
    selectedProvider: defaultProvider,
    category: {
      name: 'Aircon'
    },
    ...overrides,
  } as ServiceWithProviders;
}

describe('ServiceDetailsPage', () => {
  let component: ServiceDetailsPage;
  let fixture: ComponentFixture<ServiceDetailsPage>;
  let serviceServiceSpy: jasmine.SpyObj<ServiceService>;

  const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(async () => {
    serviceServiceSpy = jasmine.createSpyObj<ServiceService>('ServiceService', [
      'getServiceWithAllProviders',
      'getProviderOtherServices',
      'getProviderReviews',
      'getCachedServiceWithAllProviders',
      'getCachedProviderOtherServices',
      'getCachedProviderReviews',
      'invalidateServiceWithProvidersCache',
      'invalidateProviderOtherServicesCache',
      'invalidateProviderReviewsCache'
    ]);

    serviceServiceSpy.getCachedServiceWithAllProviders.and.returnValue(null);
    serviceServiceSpy.getCachedProviderOtherServices.and.returnValue(null);
    serviceServiceSpy.getCachedProviderReviews.and.returnValue(null);
    serviceServiceSpy.getProviderOtherServices.and.resolveTo([]);
    serviceServiceSpy.getProviderReviews.and.resolveTo([]);
    serviceServiceSpy.getServiceWithAllProviders.and.resolveTo(createServiceData());

    await TestBed.configureTestingModule({
      imports: [ServiceDetailsPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ serviceVariantId: 'sv1' })
            }
          }
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate')
          }
        },
        {
          provide: ServiceService,
          useValue: serviceServiceSpy
        },
        {
          provide: RealTimeService,
          useValue: {
            subscribeToProviderAvailability: jasmine.createSpy('subscribeToProviderAvailability').and.returnValue(() => {})
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ServiceDetailsPage);
    component = fixture.componentInstance;
  });

  it('should create', async () => {
    fixture.detectChanges();
    await flushPromises();
    expect(component).toBeTruthy();
  });

  it('unblocks base render before provider services finish loading', async () => {
    const providerServicesDeferred = deferred<any[]>();
    serviceServiceSpy.getProviderOtherServices.and.returnValue(providerServicesDeferred.promise);

    fixture.detectChanges();
    await flushPromises();

    expect(component.isBaseLoading()).toBeFalse();
    expect(component.isProviderServicesLoading()).toBeTrue();
    expect(serviceServiceSpy.getProviderReviews).not.toHaveBeenCalled();

    providerServicesDeferred.resolve([]);
    await flushPromises();
    expect(component.isProviderServicesLoading()).toBeFalse();
  });

  it('loads reviews only when reviews tab is opened', async () => {
    fixture.detectChanges();
    await flushPromises();

    expect(serviceServiceSpy.getProviderReviews).not.toHaveBeenCalled();

    component.onSegmentChange({ detail: { value: 'reviews' } });
    await flushPromises();

    expect(serviceServiceSpy.getProviderReviews).toHaveBeenCalledWith('p1');
  });

  it('loads provider services on provider switch without loading reviews outside reviews tab', async () => {
    const providerTwo = {
      id: 'off-2',
      providerId: 'p2',
      providerName: 'Provider Two',
      displayName: 'After5 Expert - Two',
      avatarUrl: '',
      rating: 4.7,
      reviewCount: 10,
      yearsExperience: 4,
      serviceRadius: 12,
      status: 'online',
      isDefault: false
    };

    serviceServiceSpy.getServiceWithAllProviders.and.resolveTo(createServiceData({ providers: [createServiceData().providers[0], providerTwo] as any[] }));

    fixture.detectChanges();
    await flushPromises();

    serviceServiceSpy.getProviderOtherServices.calls.reset();
    serviceServiceSpy.getProviderReviews.calls.reset();

    component.selectProvider(providerTwo as any);
    await flushPromises();

    expect(serviceServiceSpy.getProviderOtherServices).toHaveBeenCalledWith('p2', 'sv1');
    expect(serviceServiceSpy.getProviderReviews).not.toHaveBeenCalled();
  });

  it('ignores stale provider services responses when provider changes quickly', async () => {
    const providerOneDeferred = deferred<any[]>();
    const providerTwoDeferred = deferred<any[]>();

    const providerTwo = {
      id: 'off-2',
      providerId: 'p2',
      providerName: 'Provider Two',
      displayName: 'After5 Expert - Two',
      avatarUrl: '',
      rating: 4.7,
      reviewCount: 10,
      yearsExperience: 4,
      serviceRadius: 12,
      status: 'online',
      isDefault: false
    };

    serviceServiceSpy.getServiceWithAllProviders.and.resolveTo(createServiceData({ providers: [createServiceData().providers[0], providerTwo] as any[] }));
    serviceServiceSpy.getProviderOtherServices.and.callFake((providerId: string) => {
      if (providerId === 'p1') return providerOneDeferred.promise;
      return providerTwoDeferred.promise;
    });

    fixture.detectChanges();
    await flushPromises();

    component.selectProvider(providerTwo as any);

    providerTwoDeferred.resolve([
      { id: 's2', name: 'Second', price_min: 1, price_max: 2, duration_minutes: 30 }
    ] as any[]);
    await flushPromises();
    expect(component.providerServices()[0]?.id).toBe('s2');

    providerOneDeferred.resolve([
      { id: 's1', name: 'First', price_min: 1, price_max: 2, duration_minutes: 30 }
    ] as any[]);
    await flushPromises();

    expect(component.providerServices()[0]?.id).toBe('s2');
  });

  it('hydrates from cache immediately then patches with fresh network response', async () => {
    const cachedData = createServiceData({ name: 'Cached Name' });
    const freshData = createServiceData({ name: 'Fresh Name' });

    serviceServiceSpy.getCachedServiceWithAllProviders.and.returnValue(cachedData);
    serviceServiceSpy.getServiceWithAllProviders.and.resolveTo(freshData);

    fixture.detectChanges();

    expect(component.serviceTitle()).toBe('Cached Name');

    await flushPromises();
    expect(component.serviceTitle()).toBe('Fresh Name');
  });
});
