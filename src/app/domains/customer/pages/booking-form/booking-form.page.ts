import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardTitle,
  IonCardHeader,
  IonText,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonList,
  IonChip,
  IonAvatar,
  IonSpinner, IonBackButton, IonFooter, IonBadge, IonNote, IonSegment, IonSegmentButton, IonToggle, IonSkeletonText } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, CameraPermissionType } from '@capacitor/camera';
import { ServiceService, ServiceWithProvider } from '@core/services/service.service';
import { SessionService } from '@core/auth/session';
import { AddressService } from '@core/supabase/address.service';
import { BookingService } from '@core/services/booking.service';
import { RealTimeService } from '@core/services/real-time.service';
import { UserAddress, GeocodeResult } from '@core/models/address.model';
import { BookingSubmissionData, BookingResponse, BookingError } from '@core/models/booking.model';
import { NavController } from '@ionic/angular/standalone';
import { GoogleMapsService } from '@core/services/google-maps.service';
import { ToastController } from '@ionic/angular/standalone';
import { devLog, devWarn, devError } from '../../../../core/utils/logger';

interface BookingDetails {
  serviceType: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  preferredDate: string;
  preferredTimeslot: string;
  address: string;
  contactNumber: string;
  contactPerson: string;
  latitude?: number;
  longitude?: number;
  specialInstructions?: string;
}

interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
  name: string;
  size: number;
}

interface PriceBreakdown {
  baseService: number;
  urgencyFee: number;
  mediaProcessing: number;
  transportationFee: number;
  bodyCameraFee: number;
  commissionFee: number;
  total: number;
}

interface BookingNavigationState {
  selectedLocation?: GeocodeResult;
  preSelectedProviderId?: string;
}

@Component({
  selector: 'app-booking-form',
  templateUrl: './booking-form.page.html',
  styleUrls: ['./booking-form.page.scss'],
  standalone: true,
  imports: [IonFooter, IonBackButton,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonButtons,
    IonIcon,
    IonCard,
    IonCardContent,
    IonCardTitle,
    IonCardHeader,
    IonText,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonSelect,
    IonSelectOption,
    IonList,
    IonChip,
    IonAvatar,
    IonSpinner,
    IonSkeletonText,
    IonBadge,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonToggle,
    CommonModule,
    ReactiveFormsModule,
    FormsModule]
})
export class BookingFormPage implements OnInit {
  private static readonly MINIMUM_SLOT_LEAD_TIME_MINUTES = 60;

  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private navController = inject(NavController);
  private serviceService = inject(ServiceService);
  private sessionService = inject(SessionService);
  private addressService = inject(AddressService);
  private bookingService = inject(BookingService);
  private realTimeService = inject(RealTimeService);
  private googleMapsService = inject(GoogleMapsService);
  private toastController = inject(ToastController);

  // Step management
  currentStep = signal<1 | 2>(1);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  // Assigned provider info (for review display)
  assignedProvider = signal<any>(null);

  // Pre-selected provider from service details page
  preSelectedProviderId = signal<string | null>(null);
  hasPreSelectedProviderContext = signal(false);

  // Service data
  selectedService = signal<ServiceWithProvider | null>(null);
  currentServiceType = signal<string>('');
  hasServiceVariantContext = signal(false);

  // Reactive urgency signal for computed properties
  currentUrgency = signal<string>('low');

  // Reactive signals for pricing (so priceBreakdown computed re-runs when form changes)
  currentTimeslot = signal<string>('');
  bodyCameraRequestedSignal = signal<boolean>(false);
  gasAmountFeeSignal = signal<number | null>(null);

  // Reactive date signal for timeslot availability
  selectedDate = signal<string>('');

  // Address data
  userAddresses = signal<UserAddress[]>([]);
  selectedAddressId = signal<string | null>(null);
  selectedLocation = signal<GeocodeResult | null>(null);

  // Form
  bookingForm!: FormGroup;
  private formValid = signal(false);

  // Media files
  mediaFiles = signal<MediaFile[]>([]);
  isUploading = signal(false);

  // Price calculations - consistent with booking service (variant-based when selected)
  // Uses signals so computed re-runs when user changes urgency, timeslot, or body camera
  priceBreakdown = computed((): PriceBreakdown => {
    const selectedService = this.selectedService();
    const timeslot = this.currentTimeslot();
    const urgency = this.currentUrgency();
    const bodyCameraRequested = this.bodyCameraRequestedSignal();

    const isAfter5 = this.timeslots.find(t => t.value === timeslot)?.after5 || false;

    let baseService: number;
    if (selectedService) {
      baseService = isAfter5
        ? (selectedService.price_after5_min ?? selectedService.price_min)
        : selectedService.price_min;
    } else {
      baseService = 1200;
    }

    // Urgent: only "emergency" adds variant's urgent_charge when we have a variant
    const urgencyFee = selectedService && urgency === 'emergency'
      ? (selectedService.urgent_charge ?? 0)
      : this.calculateUrgencyFee();

    const transportationFee = selectedService
      ? (isAfter5
          ? (selectedService.transportation_fee_after5 ?? selectedService.transportation_fee ?? 0)
          : (selectedService.transportation_fee ?? 0))
      : 0;
    const bodyCameraFee = (bodyCameraRequested && selectedService)
      ? (selectedService.body_camera_fee ?? 0)
      : 0;
    
    // Commission depends on time tier (regular 8to5 vs after5 5to8)
    // Use minimum commission amount for the tier (or calculate from rate if amounts not available)
    let commissionFee = 0;
    if (selectedService) {
      if (isAfter5) {
        // After 5 (5PM-8AM): use commission_amount_min_5to8 or calculate from rate
        commissionFee = selectedService.commission_amount_min_5to8 ?? 
          (selectedService.commission_rate ? (baseService * selectedService.commission_rate / 100) : 0);
      } else {
        // Regular (8AM-5PM): use commission_amount_min_8to5 or calculate from rate
        commissionFee = selectedService.commission_amount_min_8to5 ?? 
          (selectedService.commission_rate ? (baseService * selectedService.commission_rate / 100) : 0);
      }
    }
    
    // Total does NOT include platform fee (commission) - it's shown separately
    const total = baseService + urgencyFee + transportationFee + bodyCameraFee;

    return {
      baseService,
      urgencyFee,
      mediaProcessing: 0, // Removed - media cost is body camera
      transportationFee,
      bodyCameraFee,
      commissionFee,
      total
    };
  });

  // Computed values for template
  selectedServiceLabel = computed(() => {
    const serviceType = this.bookingForm?.get('serviceType')?.value;
    return this.serviceTypes.find(s => s.value === serviceType)?.label || '';
  });

  selectedUrgencyLabel = computed(() => {
    const urgency = this.currentUrgency();
    return this.urgencyLevels.find(u => u.value === urgency)?.label || '';
  });

  selectedUrgencyColor = computed(() => {
    const urgency = this.currentUrgency();
    return this.urgencyLevels.find(u => u.value === urgency)?.color || 'primary';
  });

  selectedTimeslotLabel = computed(() => {
    const timeslot = this.currentTimeslot();
    return this.timeslots.find(t => t.value === timeslot)?.label || '';
  });

  selectedTimeslotRange = computed(() => {
    const timeslot = this.currentTimeslot();
    return this.timeslots.find(t => t.value === timeslot)?.range || '';
  });

  selectedTimeslotIcon = computed(() => {
    const timeslot = this.currentTimeslot();
    return this.timeslots.find(t => t.value === timeslot)?.icon || 'time-outline';
  });

  selectedTimeslotAfter5 = computed(() => {
    const timeslot = this.currentTimeslot();
    return this.timeslots.find(t => t.value === timeslot)?.after5 || false;
  });

  isRecommendedTimeslot = computed(() => {
    const urgency = this.currentUrgency();
    const currentTimeslot = this.bookingForm?.get('preferredTimeslot')?.value;
    if (!urgency || !currentTimeslot) return false;

    const recommendedTimeslot = this.getRecommendedTimeslot(urgency);
    return currentTimeslot === recommendedTimeslot;
  });

  recommendedTimeslotForUrgency = computed(() => {
    const urgency = this.currentUrgency();
    return urgency ? this.getRecommendedTimeslot(urgency) : null;
  });

  visibleTimeslots = computed(() => {
    return this.timeslots.filter(slot => !this.disabledTimeslots().has(slot.value));
  });

  isAsapSelected = computed(() => {
    return this.currentUrgency() === 'emergency';
  });

  // Disabled timeslots based on selected date and current time
  disabledTimeslots = computed(() => {
    const selectedDateStr = this.selectedDate();
    if (!selectedDateStr) return new Set<string>();

    // If selected date is not today, all timeslots are available
    if (!this.isToday(selectedDateStr)) {
      return new Set<string>();
    }

    // For today, disable only timeslots that have already ended.
    // Also disable slots with less than 60 minutes remaining before end.
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    const disabled = new Set<string>();
    this.timeslots.forEach(timeslot => {
      if (this.isTimeslotUnavailableForToday(timeslot.endTime, currentTimeInMinutes)) {
        disabled.add(timeslot.value);
      }
    });

    return disabled;
  });

  /** True when form is valid and a valid location is selected (required for step 2). */
  canProceedToReview = computed(() => {
    if (!this.formValid()) return false;
    const loc = this.selectedLocation();
    if (!loc?.lat || !loc?.lng) return false;
    if (loc.lat === 0 && loc.lng === 0) return false;
    return true;
  });

  // Smart timeslot recommendations based on urgency, selected date, and availability
  getRecommendedTimeslot(urgency: string): string {
    const selectedDate = this.bookingForm?.get('preferredDate')?.value as string | null;
    const availableSlots = this.getAvailableTimeslots(selectedDate ?? undefined);

    if (availableSlots.length === 0) {
      return this.timeslots[0].value;
    }

    // For future dates, prefer common daytime windows and keep urgency-specific guidance.
    if (selectedDate && !this.isToday(selectedDate)) {
      switch (urgency) {
        case 'emergency':
        case 'high':
          return this.pickFirstAvailableByPriority(availableSlots, ['morning', 'noon', 'afternoon', 'evening', 'late-night', 'overnight', 'dawn']);
        case 'medium':
          return this.pickFirstAvailableByPriority(availableSlots, ['noon', 'afternoon', 'morning', 'evening', 'late-night', 'overnight', 'dawn']);
        case 'low':
        default:
          return this.pickFirstAvailableByPriority(availableSlots, ['morning', 'noon', 'afternoon', 'evening', 'late-night', 'overnight', 'dawn']);
      }
    }

    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    // For today, target a slot based on urgency lead-time, then snap to the next available slot.
    switch (urgency) {
      case 'emergency':
        return this.getNextAvailableTimeslot(currentTimeInMinutes);
      case 'high':
        return this.getClosestAvailableSlotFromTime(currentTimeInMinutes + 60, availableSlots);
      case 'medium':
        return this.getClosestAvailableSlotFromTime(currentTimeInMinutes + 180, availableSlots);
      case 'low':
      default:
        return this.getClosestAvailableSlotFromTime(currentTimeInMinutes + 360, availableSlots);
    }
  }

  getCurrentTimeTimeslot(): string {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Convert to minutes since midnight for easier comparison
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Define timeslot boundaries in minutes since midnight
    const timeslotBoundaries = [
      { value: 'dawn', start: 3 * 60, end: 6 * 60 },        // 3:00 AM - 6:00 AM
      { value: 'morning', start: 8 * 60, end: 12 * 60 },    // 8:00 AM - 12:00 PM
      { value: 'noon', start: 12 * 60, end: 15 * 60 },      // 12:00 PM - 3:00 PM
      { value: 'afternoon', start: 15 * 60, end: 17 * 60 }, // 3:00 PM - 5:00 PM
      { value: 'evening', start: 17 * 60, end: 21 * 60 },   // 5:00 PM - 9:00 PM
      { value: 'late-night', start: 21 * 60, end: 24 * 60 }, // 9:00 PM - 12:00 AM
      { value: 'overnight', start: 0, end: 3 * 60 }         // 12:00 AM - 3:00 AM
    ];

    // Find the current timeslot
    const currentTimeslot = timeslotBoundaries.find(slot =>
      currentTimeInMinutes >= slot.start && currentTimeInMinutes < slot.end
    );

    if (currentTimeslot) {
      return currentTimeslot.value;
    }

    // If we're in the overnight period (12AM-3AM), return that
    if (currentTimeInMinutes >= 0 && currentTimeInMinutes < 3 * 60) {
      return 'overnight';
    }

    // If no match found (shouldn't happen), find the next available timeslot
    return this.getNextAvailableTimeslot(currentTimeInMinutes);
  }

  private getNextAvailableTimeslot(currentTimeInMinutes: number): string {
    const availableSlots = this.getAvailableTimeslots(this.selectedDate());
    if (availableSlots.length === 0) {
      return this.timeslots[0].value;
    }

    return this.getClosestAvailableSlotFromTime(currentTimeInMinutes, availableSlots);
  }

  private getFirstAvailableTimeslot(dateStr?: string): string {
    const availableTimeslots = this.getAvailableTimeslots(dateStr);

    if (availableTimeslots.length > 0) {
      return availableTimeslots[0].value;
    }

    // If no timeslots are available for today, return the first timeslot (shouldn't happen)
    return this.timeslots[0].value;
  }

  onUrgencyChange = (urgency: string) => {
    // Update urgency
    this.bookingForm.get('urgency')?.setValue(urgency);
    this.currentUrgency.set(urgency);

    if (urgency === 'emergency') {
      // For ASAP: set date to today and timeslot to current/next available slot
      const today = new Date().toISOString().split('T')[0];
      this.bookingForm.get('preferredDate')?.setValue(today);

      const recommendedTimeslot = this.getRecommendedTimeslot(urgency);
      this.bookingForm.get('preferredTimeslot')?.setValue(recommendedTimeslot);
    } else {
      // For other urgencies: don't auto-select, just let the recommended badge guide the user
      // Only set if no timeslot is currently selected
      const currentTimeslot = this.bookingForm.get('preferredTimeslot')?.value;
      if (!currentTimeslot) {
        const recommendedTimeslot = this.getRecommendedTimeslot(urgency);
        this.bookingForm.get('preferredTimeslot')?.setValue(recommendedTimeslot);
      }
      // If user already selected a timeslot, keep it but show the recommended badge on the appropriate slot
    }
  }

  selectedServicePrice = computed(() => {
    const service = this.selectedService();
    if (!service) return '';

    // Fuel Delivery: use selected gas amount (reactive to form changes)
    if (this.isFuelDelivery()) {
      const gas = this.gasAmountFeeSignal() ?? this.bookingForm?.get('gasAmountFee')?.value ?? service.properties?.['gas_amount_fee'];
      if (typeof gas === 'number') {
        return this.formatPrice(gas);
      }
    }

    const minPrice = service.price_min;
    const maxPrice = service.price_max;

    if (minPrice === maxPrice) {
      return this.formatPrice(minPrice);
    }
    return `${this.formatPrice(minPrice)} - ${this.formatPrice(maxPrice)}`;
  });

  // Step state computations
  step1State = computed(() => {
    const currentStep = this.currentStep();
    const formValid = this.bookingForm?.valid || false;

    if (currentStep === 1) return 'current';
    if (currentStep === 2 && formValid) return 'completed';
    if (currentStep === 2 && !formValid) return 'error';
    return 'pending';
  });

  step2State = computed(() => {
    const currentStep = this.currentStep();

    if (currentStep === 2) return 'current';
    return 'pending';
  });

  // Service types
  serviceTypes = [
    { value: 'locksmithing', label: 'Locksmithing', icon: 'key' },
    { value: 'aircon', label: 'Air Conditioning', icon: 'snow' },
    { value: 'electrical', label: 'Electrical', icon: 'flash' },
    { value: 'automotive', label: 'Roadside Assistance', icon: 'car' },
    { value: 'plumbing', label: 'Plumbing', icon: 'water' },
    { value: 'other', label: 'Other', icon: 'construct' }
  ];

  isFuelDelivery = computed(() => this.selectedService()?.service?.name === 'Fuel Delivery');

  // Urgency levels
  urgencyLevels = [
    { value: 'emergency', label: 'Emergency - ASAP', color: 'danger' },
    { value: 'high', label: 'High - Within 6 hours', color: 'danger' },
    { value: 'medium', label: 'Medium - Within 12 hours', color: 'warning' },
    { value: 'low', label: 'Low - Within 24 hours', color: 'success' }
  ];

  // Timeslots with their start times in minutes from midnight
  timeslots = [
    { value: 'morning', label: 'Morning', range: '8:00 AM - 12:00 PM', icon: 'sunny-outline', after5: false, startTime: 8 * 60, endTime: 12 * 60 },
    { value: 'noon', label: 'Noon', range: '12:00 PM - 3:00 PM', icon: 'sunny', after5: false, startTime: 12 * 60, endTime: 15 * 60 },
    { value: 'afternoon', label: 'Afternoon', range: '3:00 PM - 5:00 PM', icon: 'partly-sunny', after5: false, startTime: 15 * 60, endTime: 17 * 60 },
    { value: 'evening', label: 'Evening', range: '5:00 PM - 9:00 PM', icon: 'moon-outline', after5: true, startTime: 17 * 60, endTime: 21 * 60 },
    { value: 'late-night', label: 'Late Night', range: '9:00 PM - 12:00 AM', icon: 'moon', after5: true, startTime: 21 * 60, endTime: 24 * 60 },
    { value: 'overnight', label: 'Overnight', range: '12:00 AM - 3:00 AM', icon: 'cloudy-night', after5: true, startTime: 0, endTime: 3 * 60 },
    { value: 'dawn', label: 'Dawn', range: '3:00 AM - 6:00 AM', icon: 'sunny-outline', after5: true, startTime: 3 * 60, endTime: 6 * 60 }
  ];

  private isToday(dateStr: string): boolean {
    const selectedDate = new Date(dateStr);
    const selectedDateNormalized = new Date(selectedDate);
    selectedDateNormalized.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return selectedDateNormalized.getTime() === today.getTime();
  }

  private getAvailableTimeslots(dateStr?: string): typeof this.timeslots {
    if (!dateStr || !this.isToday(dateStr)) {
      return this.timeslots;
    }

    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
    return this.timeslots.filter(slot => !this.isTimeslotUnavailableForToday(slot.endTime, currentTimeInMinutes));
  }

  private isTimeslotUnavailableForToday(endTimeInMinutes: number, currentTimeInMinutes: number): boolean {
    return (endTimeInMinutes - currentTimeInMinutes) < BookingFormPage.MINIMUM_SLOT_LEAD_TIME_MINUTES;
  }

  private getClosestAvailableSlotFromTime(targetMinutes: number, availableSlots: typeof this.timeslots): string {
    const sameDaySlots = [...availableSlots].sort((a, b) => a.startTime - b.startTime);
    const targetInDay = ((targetMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);

    const futureOrCurrentSlot = sameDaySlots.find(slot => slot.endTime > targetInDay);
    if (futureOrCurrentSlot) {
      return futureOrCurrentSlot.value;
    }

    return sameDaySlots[0]?.value ?? this.timeslots[0].value;
  }

  private pickFirstAvailableByPriority(availableSlots: typeof this.timeslots, priority: string[]): string {
    const availableValues = new Set(availableSlots.map(slot => slot.value));
    const preferred = priority.find(value => availableValues.has(value));
    return preferred ?? availableSlots[0].value;
  }

  // Common service descriptions by service type
  serviceDescriptions = {
    locksmithing: [
      'Lost house keys',
      'Locked out of car',
      'Broken key in lock',
      'Need duplicate keys',
      'Lock is jammed/stuck',
      'Security upgrade needed',
      'Lock replacement required'
    ],
    aircon: [
      'AC not cooling properly',
      'Strange noises from unit',
      'Water leaking from AC',
      'Unit not turning on',
      'Unpleasant odors',
      'Thermostat issues',
      'Need filter replacement',
      'Annual maintenance/cleaning'
    ],
    electrical: [
      'Lights not working',
      'Power outlet not working',
      'Circuit breaker tripping',
      'Wiring issues',
      'Need new installation',
      'Electrical panel upgrade',
      'GFCI outlet problems',
      'Dimmer switch installation'
    ],
    automotive: [
      'Car won\'t start',
      'Flat tire',
      'Battery replacement needed',
      'Engine warning light on',
      'Brake problems',
      'Overheating issues',
      'Strange engine noises',
      'Transmission problems'
    ],
    plumbing: [
      'Leaky faucet',
      'Clogged drain/toilet',
      'Running toilet',
      'Low water pressure',
      'Pipe leak/burst',
      'Water heater issues',
      'Sewer backup',
      'Need pipe repair'
    ],
    other: [
      'General repair needed',
      'Maintenance service',
      'Installation work',
      'Custom project',
      'Emergency repair',
      'Consultation needed'
    ]
  };

  isTimeslotRecommended(timeslotValue: string): boolean {
    return !this.isAsapSelected() && timeslotValue === this.recommendedTimeslotForUrgency();
  }

  // Get common descriptions for current service type
  commonDescriptions = computed(() => {
    const serviceType = this.currentServiceType() as keyof typeof this.serviceDescriptions;
    return serviceType ? this.serviceDescriptions[serviceType] || [] : [];
  });

  constructor() {
    this.initializeForm();
  }

  async ngOnInit() {
    this.prePopulateUserData();
    const initialState = this.readNavigationState();

    if (initialState.selectedLocation) {
      this.onLocationSelected(initialState.selectedLocation);
    }

    if (initialState.preSelectedProviderId) {
      this.preSelectedProviderId.set(initialState.preSelectedProviderId);
      this.hasPreSelectedProviderContext.set(true);
    }

    await this.loadUserAddresses();
    const serviceId = this.route.snapshot.paramMap.get('id');
    this.hasServiceVariantContext.set(Boolean(serviceId));
    if (serviceId) {
      await this.loadServiceData(serviceId);
    }
  }

  ionViewWillEnter() {
    const state = this.readNavigationState();

    if (state?.selectedLocation) {
      this.onLocationSelected(state.selectedLocation);
    }

    let shouldReloadServiceData = false;
    if (state?.preSelectedProviderId && state.preSelectedProviderId !== this.preSelectedProviderId()) {
      this.preSelectedProviderId.set(state.preSelectedProviderId);
      this.hasPreSelectedProviderContext.set(true);
      shouldReloadServiceData = this.selectedService()?.provider?.id !== state.preSelectedProviderId;
    }

    if (shouldReloadServiceData) {
      const serviceId = this.route.snapshot.paramMap.get('id');
      if (serviceId) {
        void this.loadServiceData(serviceId);
      }
    }

    // Clear the state after using it
    if (state?.selectedLocation || state?.preSelectedProviderId) {
      history.replaceState({}, '');
    }

    if (Capacitor.isNativePlatform()) {
      document.addEventListener('ionBackButton', this.handleHardwareBack);
    }
  }

  ionViewWillLeave() {
    if (Capacitor.isNativePlatform()) {
      document.removeEventListener('ionBackButton', this.handleHardwareBack);
    }
  }

  private handleHardwareBack = (ev: Event) => {
    const customEv = ev as CustomEvent<{ register: (priority: number, handler: (processNextHandler: () => void) => void) => void }>;
    customEv.detail.register(10, (processNextHandler) => {
      if (this.currentStep() === 2) {
        this.previousStep();
      } else {
        processNextHandler();
      }
    });
  };

  private readNavigationState(): BookingNavigationState {
    const navigation = this.router.getCurrentNavigation();
    const routerState = navigation?.extras?.state as BookingNavigationState | undefined;
    const historyState = history.state as BookingNavigationState | undefined;

    return {
      selectedLocation: routerState?.selectedLocation ?? historyState?.selectedLocation,
      preSelectedProviderId: routerState?.preSelectedProviderId ?? historyState?.preSelectedProviderId
    };
  }

  private prePopulateUserData() {
    const profile = this.sessionService.profile();
    if (profile) {
      // Pre-populate contact person with user's full name
      const formValues: any = {
        contactPerson: profile.full_name
      };

      // Pre-populate contact number if available
      if (profile.phone_number) {
        formValues.contactNumber = profile.phone_number;
      }

      this.bookingForm.patchValue(formValues);
    }
  }

  private loadUserAddresses = async () => {
    try {
      const result = await this.addressService.getUserAddresses();
      if (result.error) {
        devError('Error loading user addresses:', result.error);
      } else {
        this.userAddresses.set(result.data || []);
      }
    } catch (error) {
      devError('Unexpected error loading user addresses:', error);
    }
  }

  loadServiceData = async (serviceVariantId: string) => {
    try {
      this.isLoading.set(true);
      const serviceData = await this.serviceService.getServiceWithProvider(
        serviceVariantId,
        this.preSelectedProviderId() || undefined
      );
      if (serviceData) {
        this.selectedService.set(serviceData);
        this.prePopulateFormWithServiceData(serviceData);
      }
    } catch (error) {
      devError('Error loading service data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private prePopulateFormWithServiceData(serviceData: ServiceWithProvider) {
    // Map service category to service type
    const serviceTypeMapping: { [key: string]: string } = {
      'locksmithing': 'locksmithing',
      'aircon': 'aircon',
      'electrical': 'electrical',
      'automotive': 'automotive',
      'plumbing': 'plumbing'
    };

    const mappedServiceType = serviceTypeMapping[serviceData.category?.name?.toLowerCase()] || 'other';

    // Update current service type signal
    this.currentServiceType.set(mappedServiceType);

    // Pre-populate form with service data; set gas from variant properties when Fuel Delivery
    const gasFromVariant = serviceData.service?.name === 'Fuel Delivery'
      ? (serviceData.properties?.['gas_amount_fee'] ?? null)
      : null;
    this.bookingForm.patchValue({
      serviceType: mappedServiceType,
      description: `Service requested: ${serviceData.name}\n\n${serviceData.description || ''}`,
      gasAmountFee: gasFromVariant
    });
    if (gasFromVariant != null && typeof gasFromVariant === 'number') {
      this.gasAmountFeeSignal.set(gasFromVariant);
    }
  }

  private initializeForm() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];

    this.bookingForm = this.formBuilder.group({
      serviceType: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      urgency: ['low', Validators.required],
      preferredDate: [today, Validators.required], // Default to today
      preferredTimeslot: ['', Validators.required],
      address: ['', Validators.required],
      contactNumber: ['', [Validators.required, Validators.pattern(/^(\+63|0)[9]\d{9}$/)]],
      contactPerson: ['', Validators.required],
      latitude: [null],
      longitude: [null],
      specialInstructions: [''],
      bodyCameraRequested: [false],
      gasAmountFee: [null as number | null]
    });

    // Track form validity as a signal so canProceedToReview reacts to form changes
    this.bookingForm.statusChanges.subscribe(() => {
      this.formValid.set(this.bookingForm.valid);
    });

    // Initialize signals
    this.currentServiceType.set('');
    this.currentUrgency.set('low');
    this.selectedDate.set(today);

    // Listen to service type changes to update currentServiceType signal
    this.bookingForm.get('serviceType')?.valueChanges.subscribe(value => {
      this.currentServiceType.set(value || '');
    });

    // Listen to urgency changes to update currentUrgency signal
    this.bookingForm.get('urgency')?.valueChanges.subscribe(value => {
      this.currentUrgency.set(value || 'low');
    });

    // Listen to timeslot and body camera so priceBreakdown computed re-runs
    this.bookingForm.get('preferredTimeslot')?.valueChanges.subscribe(value => {
      this.currentTimeslot.set(value ?? '');
    });
    this.bookingForm.get('bodyCameraRequested')?.valueChanges.subscribe(value => {
      this.bodyCameraRequestedSignal.set(value === true);
    });

    // Fuel Delivery: when gas amount changes, update description and price display
    this.bookingForm.get('gasAmountFee')?.valueChanges.subscribe(amount => {
      this.gasAmountFeeSignal.set(amount ?? null);
      if (this.isFuelDelivery() && amount != null) {
        const descCtrl = this.bookingForm.get('description');
        const current = descCtrl?.value || '';
        const tail = current.replace(/^Service requested: .+?\n\n?/s, '').trim();
        const baseDesc = this.selectedService()?.description || '';
        descCtrl?.patchValue(
          `Service requested: ₱${Number(amount).toLocaleString()} gas\n\n${tail || baseDesc}`,
          { emitEvent: false }
        );
      }
    });

    // Listen to date changes to update selectedDate signal and adjust timeslot if needed
    this.bookingForm.get('preferredDate')?.valueChanges.subscribe(value => {
      this.selectedDate.set(value || '');

      // Check if current timeslot becomes disabled and adjust if necessary
      const currentTimeslot = this.bookingForm.get('preferredTimeslot')?.value;
      const disabledTimeslots = this.disabledTimeslots();

      if (currentTimeslot && disabledTimeslots.has(currentTimeslot)) {
        // Current timeslot is now disabled, select the first available one
        const firstAvailable = this.getFirstAvailableTimeslot(value);
        this.bookingForm.get('preferredTimeslot')?.setValue(firstAvailable);
      }
    });

    // Set initial timeslot based on current availability
    const initialTimeslot = this.getFirstAvailableTimeslot(today);
    this.bookingForm.get('preferredTimeslot')?.setValue(initialTimeslot);
    this.currentTimeslot.set(initialTimeslot ?? '');

    // Add custom validation for location (either coordinates or manually entered address)
    this.bookingForm.get('address')?.setValidators([
      (control) => {
        const address = control.value;
        const latitude = this.bookingForm.get('latitude')?.value;
        const longitude = this.bookingForm.get('longitude')?.value;

        // If coordinates are set and address is provided, it's valid (map selection)
        if (latitude && longitude && address && address.trim().length > 0) {
          return null;
        }

        // If coordinates are set but no address, still valid (fallback to coordinates)
        if (latitude && longitude) {
          return null;
        }

        // If no coordinates but address is provided, it's valid (manual entry)
        if (address && address.trim().length > 0) {
          return null;
        }

        return { locationRequired: true };
      }
    ]);

    // Trigger address revalidation when coordinates change
    this.bookingForm.get('latitude')?.valueChanges.subscribe(() => {
      this.bookingForm.get('address')?.updateValueAndValidity();
    });

    this.bookingForm.get('longitude')?.valueChanges.subscribe(() => {
      this.bookingForm.get('address')?.updateValueAndValidity();
    });
  }

  /** Used only when no variant is selected; variant flow uses urgent_charge for emergency only. */
  private calculateUrgencyFee(): number {
    const urgency = this.bookingForm?.get('urgency')?.value;
    switch (urgency) {
      case 'low': return 0;
      case 'medium': return 300;
      case 'high': return 600;
      case 'emergency': return 1000;
      default: return 0;
    }
  }

  // Navigation methods (arrow functions to preserve 'this' context)
  nextStep = () => {
    if (this.canProceedToReview() && this.currentStep() === 1) {
      this.currentStep.set(2);
    }
  }

  previousStep = () => {
    if (this.currentStep() === 2) {
      this.currentStep.set(1);
    }
  }

  onSegmentChange = (event: any) => {
    const raw = event.detail?.value;
    const value = (typeof raw === 'string' ? parseInt(raw, 10) : raw) as 1 | 2;
    if (value === 1 || value === 2) {
      // Only allow navigation to step 2 if form valid and location selected
      if (value === 2 && !this.canProceedToReview()) {
        return;
      }
      this.currentStep.set(value);
    }
  }

  // Camera and file methods (arrow functions to preserve 'this' context)
  takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        saveToGallery: true
      });

      if (image.webPath) {
        await this.addMediaFileFromUri(image.webPath, 'image', `photo_${Date.now()}.jpg`);
      }
    } catch (error) {
      devError('Error taking photo:', error);
      this.errorMessage.set('Failed to take photo. Please try again.');
    }
  }

  selectFromGallery = async () => {
    try {
      // Check and request photos permissions
      const permissions = await Camera.checkPermissions();
      if (permissions.photos !== 'granted') {
        const requestResult = await Camera.requestPermissions({
          permissions: ['photos']
        });
        if (requestResult.photos !== 'granted') {
          this.errorMessage.set('Photo gallery permission is required to select images.');
          return;
        }
      }

      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos
      });

      if (image.webPath) {
        await this.addMediaFileFromUri(image.webPath, 'image', `gallery_${Date.now()}.jpg`);
      }
    } catch (error) {
      devError('Error selecting from gallery:', error);
      this.errorMessage.set('Failed to select image from gallery. Please try again.');
    }
  }

  private addMediaFileFromUri = async (uri: string, type: 'image' | 'video', name: string) => {
    try {
      // Convert URI to File object
      const response = await fetch(uri);
      const blob = await response.blob();
      const file = new File([blob], name, { type: blob.type });

      const mediaFile: MediaFile = {
        id: Date.now().toString(),
        file,
        preview: uri,
        type,
        name,
        size: file.size
      };

      this.mediaFiles.update(files => [...files, mediaFile]);
    } catch (error) {
      devError('Error adding media file:', error);
      this.errorMessage.set('Failed to add media file. Please try again.');
    }
  }

  removeMediaFile = (fileId: string) => {
    this.mediaFiles.update(files => files.filter(f => f.id !== fileId));
  }


  // Submit booking (arrow function to preserve 'this' context)
  submitBooking = async () => {
    devLog('submitBooking called');
    
    if (!this.bookingForm.valid) {
      devWarn('Form is not valid');
      return;
    }

    // Check authentication - try to refresh profile if missing
    const isAuthenticated = this.sessionService.isAuthenticated();
    let profile = this.sessionService.profile();
    
    devLog('Auth check:', { 
      isAuthenticated, 
      hasProfile: !!profile, 
      isLoading: this.sessionService.isLoading(),
      profileId: profile?.id 
    });
    
    if (!isAuthenticated) {
      devError('User not authenticated - no session');
      this.errorMessage.set('Please log in to submit a booking.');
      setTimeout(() => {
        this.router.navigate(['/auth/welcome'], {
          queryParams: { returnUrl: this.router.url }
        });
      }, 2000);
      return;
    }
    
    // If authenticated but profile not loaded, try to refresh it
    if (!profile) {
      devWarn('Profile missing but session exists - attempting to refresh profile');
      try {
        const session = this.sessionService.session();
        if (session?.user?.id) {
          // Try to manually trigger profile fetch via session service
          // Use the session user ID directly as fallback
          devLog('Using session user ID as fallback:', session.user.id);
          // We'll pass the user ID to booking service to handle
        } else {
          throw new Error('No user ID in session');
        }
      } catch (error) {
        devError('Failed to get user ID from session:', error);
        this.errorMessage.set('Unable to load your profile. Please refresh the page and try again.');
        return;
      }
    }
    
    devLog('Authentication confirmed:', { profileId: profile?.id || 'using session', role: profile?.role });

    const lat = this.selectedLocation()?.lat;
    const lng = this.selectedLocation()?.lng;
    if (!lat || !lng || (lat === 0 && lng === 0)) {
      devWarn('Invalid location coordinates');
      this.errorMessage.set('Please select your location on the map for accurate service delivery.');
      return;
    }

    const loc = this.selectedLocation();
    const locationValidation = this.googleMapsService.validateLocation(lat, lng, loc?.address);
    if (!locationValidation.valid) {
      this.errorMessage.set(locationValidation.error ?? 'Location outside service area.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      devLog('Starting booking submission...');
      const formValue = this.bookingForm.value;
      const preferredDateTime = this.combineDateAndTimeslot(
        formValue.preferredDate,
        formValue.preferredTimeslot
      );
      const providerIdFromSelectionContext = this.hasPreSelectedProviderContext()
        ? (this.preSelectedProviderId() || this.selectedService()?.provider?.id || undefined)
        : undefined;

      const bookingData: BookingSubmissionData = {
        serviceType: formValue.serviceType,
        description: formValue.description,
        urgency: formValue.urgency,
        preferredDate: formValue.preferredDate,
        preferredTimeslot: formValue.preferredTimeslot,
        preferredDateTime,
        location: {
          lat: this.selectedLocation()?.lat || 0,
          lng: this.selectedLocation()?.lng || 0,
          address: formValue.address
        },
        contactInfo: {
          person: formValue.contactPerson,
          phone: formValue.contactNumber
        },
        mediaFiles: this.mediaFiles(),
        specialInstructions: formValue.specialInstructions,
        gasAmountFee: this.isFuelDelivery()
          ? (formValue.gasAmountFee ?? this.selectedService()?.properties?.['gas_amount_fee'] ?? undefined)
          : undefined,
        serviceVariantId: this.selectedService()?.id,
        preSelectedProviderId: providerIdFromSelectionContext,
        bodyCameraRequested: formValue.bodyCameraRequested === true
      };

      devLog('Calling bookingService.createBooking with data:', {
        serviceType: bookingData.serviceType,
        urgency: bookingData.urgency,
        hasVariant: !!bookingData.serviceVariantId,
        bodyCameraRequested: bookingData.bodyCameraRequested
      });

      const response: BookingResponse = await this.bookingService.createBooking(bookingData);

      devLog('Booking created successfully:', response.bookingId);

      // Toast: booking created
      const toast = await this.toastController.create({
        message: 'Your booking has been submitted and is being processed.',
        color: 'warning',
        duration: 3000,
        position: 'top'
      });
      await toast.present();

      // Store assigned provider for review display
      this.assignedProvider.set(response.assignedProvider);

      // Navigate to booking details with real-time updates
      this.router.navigate(['/c/bookings', response.bookingId], {
        state: { bookingResponse: response }
      });

    } catch (error) {
      devError('Error submitting booking:', error);
      devError('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      this.errorMessage.set(this.handleBookingError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleBookingError(error: any): string {
    if (error instanceof BookingError) {
      switch (error.code) {
        case 'AUTH_REQUIRED':
          return 'Please log in to submit a booking.';
        case 'BOOKING_CREATION_FAILED':
          return 'Failed to create booking. Please try again.';
        case 'PROVIDER_ASSIGNMENT_FAILED':
          return 'Unable to find an available provider. Please try again later.';
        case 'MEDIA_UPLOAD_FAILED':
          return 'Some media files failed to upload. Please check your connection and try again.';
        default:
          return error.message || 'An unexpected error occurred.';
      }
    }
    return 'An unexpected error occurred. Please try again.';
  }

  // Handle description chip click (arrow function to preserve 'this' context)
  addDescriptionChip = (chipText: string) => {
    const currentDescription = this.bookingForm.get('description')?.value || '';
    const newDescription = currentDescription
      ? `${currentDescription}\n• ${chipText}`
      : `• ${chipText}`;

    this.bookingForm.get('description')?.setValue(newDescription);
  }

  // Utility methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getUrgencyColor(urgency: string): string {
    return this.urgencyLevels.find(level => level.value === urgency)?.color || 'primary';
  }

  getServiceIcon(serviceType: string): string {
    return this.serviceTypes.find(service => service.value === serviceType)?.icon || 'construct';
  }

  // Address and location selection methods (arrow functions to preserve 'this' context)
  openAddressSelector = () => {
    // Store current form state in session storage before navigating
    const currentServiceId = this.route.snapshot.paramMap.get('id');
    this.navController.navigateForward('/c/address-selector', {
      state: {
        returnUrl: currentServiceId ? `/c/book/${currentServiceId}` : '/c/book'
      }
    });
  }

  clearSelectedLocation = () => {
    this.selectedLocation.set(null);
    this.selectedAddressId.set(null);
    this.bookingForm.patchValue({
      address: '',
      latitude: null,
      longitude: null
    });
  }

  selectSavedAddress = async (address: UserAddress) => {
    const validation = this.googleMapsService.validateLocation(address.location.lat, address.location.lng, address.full_address);
    if (!validation.valid) {
      const toast = await this.toastController.create({
        message: validation.error ?? 'Location outside service area.',
        color: 'danger',
        duration: 4000,
        position: 'bottom'
      });
      await toast.present();
      return;
    }

    this.selectedAddressId.set(address.id);
    this.selectedLocation.set({
      lat: address.location.lat,
      lng: address.location.lng,
      address: address.full_address
    });

    this.bookingForm.patchValue({
      address: address.full_address,
      latitude: address.location.lat,
      longitude: address.location.lng
    });
  }

  onLocationSelected = async (location: GeocodeResult) => {
    const validation = this.googleMapsService.validateLocation(location.lat, location.lng, location.address);
    if (!validation.valid) {
      const toast = await this.toastController.create({
        message: validation.error ?? 'Location outside service area.',
        color: 'danger',
        duration: 4000,
        position: 'bottom'
      });
      await toast.present();
      return;
    }

    this.selectedLocation.set(location);
    this.selectedAddressId.set(null);

    this.bookingForm.patchValue({
      address: location.address,
      latitude: location.lat,
      longitude: location.lng
    });
  }

  onAddressInputChange = (event: any) => {
    const value = event.target.value;
    if (value !== this.selectedLocation()?.address) {
      // Clear location selection if user manually edits address
      this.selectedLocation.set(null);
      this.selectedAddressId.set(null);
      this.bookingForm.patchValue({
        latitude: null,
        longitude: null
      });
    }
  }

  getInitialMapLocation(): { lat: number; lng: number } | null {
    // Try to get location from default address first
    const defaultAddress = this.userAddresses().find(addr => addr.is_default);
    if (defaultAddress) {
      return { lat: defaultAddress.location.lat, lng: defaultAddress.location.lng };
    }

    // Fallback to Manila coordinates
    return { lat: 14.5995, lng: 120.9842 };
  }

  getAddressIcon(label: string): string {
    const iconMap: { [key: string]: string } = {
      'Home': 'home',
      'Work': 'business',
      'School': 'school',
      'Gym': 'fitness',
      'Restaurant': 'restaurant',
      'Park': 'leaf',
      'Hospital': 'medical',
      'Mall': 'storefront',
      'Airport': 'airplane',
      'Other': 'location'
    };
    return iconMap[label] || 'location';
  }

  getMinDate(): string {
    // Return today's date in YYYY-MM-DD format to prevent selecting past dates
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  combineDateAndTimeslot(date: string, timeslot: string): string {
    // Combine the selected date with the start time of the selected timeslot
    const timeslotStartTimes: { [key: string]: string } = {
      'morning': '08:00',
      'noon': '12:00',
      'afternoon': '15:00',
      'evening': '17:00',
      'late-night': '21:00',
      'overnight': '00:00',
      'dawn': '03:00'
    };

    const startTime = timeslotStartTimes[timeslot] || '09:00';
    return `${date}T${startTime}:00`;
  }

  bodyCameraFeeDisplay(): string {
    const fee = this.selectedService()?.body_camera_fee;
    if (fee == null || fee === 0) return 'a small fee';
    return this.formatPrice(fee);
  }

  formatPrice(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '---';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}
