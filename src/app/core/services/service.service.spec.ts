import { TestBed } from '@angular/core/testing';
import { ServiceService } from './service.service';
import { SupabaseService } from '../supabase/supabase';

describe('ServiceService cache helpers', () => {
  let service: ServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ServiceService,
        {
          provide: SupabaseService,
          useValue: { client: {} }
        }
      ]
    });

    service = TestBed.inject(ServiceService);
  });

  it('returns cached service-with-providers value within ttl', () => {
    const data = { id: 'sv1' } as any;

    service.setServiceWithProvidersCache('sv1', data);

    expect(service.getCachedServiceWithAllProviders('sv1')).toEqual(data);
  });

  it('invalidates service-with-providers cache entry', () => {
    const data = { id: 'sv1' } as any;

    service.setServiceWithProvidersCache('sv1', data);
    service.invalidateServiceWithProvidersCache('sv1');

    expect(service.getCachedServiceWithAllProviders('sv1')).toBeNull();
  });

  it('expires provider other-services cache entries based on ttl', () => {
    const data = [{ id: 'other-1' }] as any;

    service.setProviderOtherServicesCache('p1', 'sv1', data);

    const cacheMap = (service as any).providerOtherServicesCache as Map<string, { data: unknown; ts: number }>;
    const entry = cacheMap.get('p1|sv1');
    if (!entry) {
      fail('Expected cache entry to be set');
      return;
    }

    entry.ts = Date.now() - (2 * 60 * 1000) - 1;
    cacheMap.set('p1|sv1', entry);

    expect(service.getCachedProviderOtherServices('p1', 'sv1')).toBeNull();
  });

  it('invalidates provider other-services entries by provider id', () => {
    service.setProviderOtherServicesCache('p1', 'sv1', [{ id: 'a' }] as any);
    service.setProviderOtherServicesCache('p1', 'sv2', [{ id: 'b' }] as any);
    service.setProviderOtherServicesCache('p2', 'sv1', [{ id: 'c' }] as any);

    service.invalidateProviderOtherServicesCache('p1');

    expect(service.getCachedProviderOtherServices('p1', 'sv1')).toBeNull();
    expect(service.getCachedProviderOtherServices('p1', 'sv2')).toBeNull();
    expect(service.getCachedProviderOtherServices('p2', 'sv1')).toEqual([{ id: 'c' }] as any);
  });

  it('sets, gets, and invalidates provider reviews cache', () => {
    const reviews = [{ id: 'r1' }] as any;

    service.setProviderReviewsCache('p1', reviews);
    expect(service.getCachedProviderReviews('p1')).toEqual(reviews);

    service.invalidateProviderReviewsCache('p1');
    expect(service.getCachedProviderReviews('p1')).toBeNull();
  });
});

describe('ServiceService.getServiceWithProvider', () => {
  const createVariantData = () => ({
    id: 'sv1',
    service: {
      id: 's1',
      service_categories: {
        name: 'Aircon',
        icon_url: 'icon.png'
      }
    }
  });

  const createOfferingsData = () => ([
    {
      created_at: '2024-01-01T00:00:00.000Z',
      provider: {
        id: 'provider-top-rated',
        rating_avg: 4.9,
        rating_count: 100,
        years_of_experience: 10,
        service_radius_km: 20,
        status: 'online',
        engagement_score: 0,
        verification_status: 'verified',
        profiles: {
          full_name: 'Top Rated',
          avatar_url: 'top.png'
        }
      }
    },
    {
      created_at: '2024-01-02T00:00:00.000Z',
      provider: {
        id: 'provider-selected',
        rating_avg: 4.1,
        rating_count: 10,
        years_of_experience: 3,
        service_radius_km: 12,
        status: 'online',
        engagement_score: 0,
        verification_status: 'verified',
        profiles: {
          full_name: 'Selected Provider',
          avatar_url: 'selected.png'
        }
      }
    }
  ]);

  const createService = (variantData: any, offeringsData: any[]) => {
    const variantBuilder: any = {
      select: jasmine.createSpy('variantSelect').and.returnValue(null),
      eq: jasmine.createSpy('variantEq').and.returnValue(null),
      single: jasmine.createSpy('variantSingle').and.resolveTo({ data: variantData, error: null })
    };
    variantBuilder.select.and.returnValue(variantBuilder);
    variantBuilder.eq.and.returnValue(variantBuilder);

    const offeringsBuilder: any = {
      select: jasmine.createSpy('offeringSelect').and.returnValue(null),
      eq: jasmine.createSpy('offeringEq').and.returnValue(null),
      then: (resolve: (value: any) => any) => Promise.resolve(resolve({ data: offeringsData, error: null }))
    };
    offeringsBuilder.select.and.returnValue(offeringsBuilder);
    offeringsBuilder.eq.and.returnValue(offeringsBuilder);

    const client = {
      from: jasmine.createSpy('from').and.callFake((table: string) => {
        if (table === 'service_variants') return variantBuilder;
        if (table === 'provider_offerings') return offeringsBuilder;
        throw new Error(`Unexpected table: ${table}`);
      })
    };

    TestBed.configureTestingModule({
      providers: [
        ServiceService,
        {
          provide: SupabaseService,
          useValue: { client }
        }
      ]
    });

    return TestBed.inject(ServiceService);
  };

  it('returns preferred provider when preferred id is present in offerings', async () => {
    const service = createService(createVariantData(), createOfferingsData());

    const result = await service.getServiceWithProvider('sv1', 'provider-selected');

    expect(result?.provider.id).toBe('provider-selected');
    expect(result?.provider.profile?.full_name).toBe('Selected Provider');
  });

  it('falls back to highest-rated provider when preferred id is missing', async () => {
    const service = createService(createVariantData(), createOfferingsData());

    const result = await service.getServiceWithProvider('sv1');

    expect(result?.provider.id).toBe('provider-top-rated');
    expect(result?.provider.profile?.full_name).toBe('Top Rated');
  });
});
