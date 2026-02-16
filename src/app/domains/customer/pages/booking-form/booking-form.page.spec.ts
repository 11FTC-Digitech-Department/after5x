import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { BookingFormPage } from './booking-form.page';
import { ServiceService, ServiceWithProvider } from '@core/services/service.service';
import { SessionService } from '@core/auth/session';
import { AddressService } from '@core/supabase/address.service';
import { BookingService } from '@core/services/booking.service';
import { RealTimeService } from '@core/services/real-time.service';
import { NavController } from '@ionic/angular/standalone';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createServiceWithProvider(overrides?: Partial<ServiceWithProvider>): ServiceWithProvider {
  return {
    id: 'sv1',
    service_id: 's1',
    name: 'AC Cleaning',
    description: 'Service description',
    price_min: 100,
    price_max: 200,
    price_after5_min: 120,
    price_after5_max: 240,
    vat_rate: 0.12,
    transportation_fee: 100,
    commission_rate: 10,
    duration_minutes: 60,
    is_active: true,
    created_at: '',
    updated_at: '',
    service: {
      id: 's1',
      category_id: 'c1',
      name: 'Aircon',
      description: 'Aircon service',
      booking_form_schema: [],
      is_active: true,
      created_at: '',
      updated_at: '',
    },
    provider: {
      id: 'provider-selected',
      years_of_experience: 5,
      service_radius_km: 10,
      status: 'online',
      rating_avg: 4.7,
      rating_count: 10,
      engagement_score: 0,
      verification_status: 'verified',
      created_at: '',
      updated_at: '',
      profile: {
        full_name: 'Selected Provider',
        avatar_url: ''
      }
    },
    category: {
      name: 'Aircon'
    },
    ...overrides
  } as ServiceWithProvider;
}

describe('BookingFormPage', () => {
  let component: BookingFormPage;
  let fixture: ComponentFixture<BookingFormPage>;
  let serviceServiceSpy: jasmine.SpyObj<ServiceService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeStub: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> } };

  const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(async () => {
    routeStub = {
      snapshot: {
        paramMap: convertToParamMap({ id: 'sv1' })
      }
    };

    serviceServiceSpy = jasmine.createSpyObj<ServiceService>('ServiceService', ['getServiceWithProvider']);
    serviceServiceSpy.getServiceWithProvider.and.resolveTo(createServiceWithProvider());

    routerSpy = jasmine.createSpyObj<Router>('Router', ['getCurrentNavigation', 'navigate']);
    routerSpy.getCurrentNavigation.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [BookingFormPage],
      providers: [
        { provide: ServiceService, useValue: serviceServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: routeStub },
        {
          provide: SessionService,
          useValue: {
            profile: jasmine.createSpy('profile').and.returnValue({
              id: 'user-1',
              full_name: 'Test User',
              phone_number: '09171234567'
            }),
            isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(true),
            isLoading: jasmine.createSpy('isLoading').and.returnValue(false),
            session: jasmine.createSpy('session').and.returnValue({ user: { id: 'user-1' } })
          }
        },
        {
          provide: AddressService,
          useValue: {
            getUserAddresses: jasmine.createSpy('getUserAddresses').and.resolveTo({ data: [], error: null })
          }
        },
        {
          provide: BookingService,
          useValue: {
            createBooking: jasmine.createSpy('createBooking')
          }
        },
        {
          provide: RealTimeService,
          useValue: {}
        },
        {
          provide: NavController,
          useValue: {
            navigateForward: jasmine.createSpy('navigateForward')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookingFormPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('passes pre-selected provider id to getServiceWithProvider during init', async () => {
    routerSpy.getCurrentNavigation.and.returnValue({
      extras: {
        state: {
          preSelectedProviderId: 'provider-2'
        }
      }
    } as any);

    await component.ngOnInit();

    expect(serviceServiceSpy.getServiceWithProvider).toHaveBeenCalledWith('sv1', 'provider-2');
  });

  it('calls getServiceWithProvider with undefined preferred provider when no preselection exists', async () => {
    await component.ngOnInit();

    expect(serviceServiceSpy.getServiceWithProvider).toHaveBeenCalledWith('sv1', undefined);
  });

  it('shows loading hero placeholder and hides service selector while variant service is loading', () => {
    const loadingDeferred = deferred<ServiceWithProvider | null>();
    serviceServiceSpy.getServiceWithProvider.and.returnValue(loadingDeferred.promise);

    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.selected-service-hero.is-loading')).not.toBeNull();
    expect(root.querySelector('ion-select[formControlName="serviceType"]')).toBeNull();
  });

  it('replaces loading hero with selected service hero after data resolves', async () => {
    const loadingDeferred = deferred<ServiceWithProvider | null>();
    serviceServiceSpy.getServiceWithProvider.and.returnValue(loadingDeferred.promise);

    fixture.detectChanges();
    loadingDeferred.resolve(createServiceWithProvider());
    await flushPromises();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.selected-service-hero.is-loading')).toBeNull();
    expect(root.querySelector('.selected-service-hero')).not.toBeNull();
    expect(root.textContent).toContain('Selected Provider');
  });
});
