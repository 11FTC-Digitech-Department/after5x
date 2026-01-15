import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  IonSelect,
  IonSelectOption,
  IonList,
  IonChip,
  IonAvatar,
  IonSpinner, IonBackButton, IonFooter, IonBadge, IonNote } from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ServiceService, ServiceWithProvider } from '@core/services/service.service';
import { SessionService } from '@core/auth/session';
import { AddressService } from '@core/supabase/address.service';
import { UserAddress, GeocodeResult } from '@core/models/address.model';
import { NavController } from '@ionic/angular/standalone';

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
  total: number;
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
    IonSelect,
    IonSelectOption,
    IonList,
    IonChip,
    IonAvatar,
    IonSpinner,
    IonBadge,
    IonNote,
    CommonModule,
    ReactiveFormsModule]
})
export class BookingFormPage implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private navController = inject(NavController);
  private serviceService = inject(ServiceService);
  private sessionService = inject(SessionService);
  private addressService = inject(AddressService);

  // Step management
  currentStep = signal<1 | 2>(1);
  isLoading = signal(false);

  // Service data
  selectedService = signal<ServiceWithProvider | null>(null);
  currentServiceType = signal<string>('');

  // Address data
  userAddresses = signal<UserAddress[]>([]);
  selectedAddressId = signal<string | null>(null);
  selectedLocation = signal<GeocodeResult | null>(null);

  // Form
  bookingForm!: FormGroup;

  // Media files
  mediaFiles = signal<MediaFile[]>([]);
  isUploading = signal(false);

  // Price calculations
  priceBreakdown = computed((): PriceBreakdown => {
    const selectedService = this.selectedService();
    const baseService = selectedService
      ? (selectedService.price_min + selectedService.price_max) / 2 // Use average of price range
      : 1200; // Fallback base service fee
    const urgencyFee = this.calculateUrgencyFee();
    const mediaProcessing = this.mediaFiles().length * 100; // ₱100 per media file
    const total = baseService + urgencyFee + mediaProcessing;

    return {
      baseService,
      urgencyFee,
      mediaProcessing,
      total
    };
  });

  // Computed values for template
  selectedServiceLabel = computed(() => {
    const serviceType = this.bookingForm?.get('serviceType')?.value;
    return this.serviceTypes.find(s => s.value === serviceType)?.label || '';
  });

  selectedUrgencyLabel = computed(() => {
    const urgency = this.bookingForm?.get('urgency')?.value;
    return this.urgencyLevels.find(u => u.value === urgency)?.label || '';
  });

  selectedUrgencyColor = computed(() => {
    const urgency = this.bookingForm?.get('urgency')?.value;
    return this.urgencyLevels.find(u => u.value === urgency)?.color || 'primary';
  });

  selectedTimeslotLabel = computed(() => {
    const timeslot = this.bookingForm?.get('preferredTimeslot')?.value;
    return this.timeslots.find(t => t.value === timeslot)?.label || '';
  });

  selectedTimeslotRange = computed(() => {
    const timeslot = this.bookingForm?.get('preferredTimeslot')?.value;
    return this.timeslots.find(t => t.value === timeslot)?.range || '';
  });

  selectedTimeslotIcon = computed(() => {
    const timeslot = this.bookingForm?.get('preferredTimeslot')?.value;
    return this.timeslots.find(t => t.value === timeslot)?.icon || 'time-outline';
  });

  selectedTimeslotAfter5 = computed(() => {
    const timeslot = this.bookingForm?.get('preferredTimeslot')?.value;
    return this.timeslots.find(t => t.value === timeslot)?.after5 || false;
  });

  isRecommendedTimeslot = computed(() => {
    const urgency = this.bookingForm?.get('urgency')?.value;
    const currentTimeslot = this.bookingForm?.get('preferredTimeslot')?.value;
    if (!urgency || !currentTimeslot) return false;

    const recommendedTimeslot = this.getRecommendedTimeslot(urgency);
    return currentTimeslot === recommendedTimeslot;
  });

  recommendedTimeslotForUrgency = computed(() => {
    const urgency = this.bookingForm?.get('urgency')?.value;
    return urgency ? this.getRecommendedTimeslot(urgency) : null;
  });

  isAsapSelected = computed(() => {
    return this.bookingForm?.get('urgency')?.value === 'emergency';
  });

  // Smart timeslot recommendations based on urgency
  getRecommendedTimeslot(urgency: string): string {
    const recommendations: { [key: string]: string } = {
      'low': 'morning',        // Within 24 hours - convenient morning slot
      'medium': 'afternoon',   // Within 12 hours - afternoon slot
      'high': 'evening',       // Within 6 hours - immediate evening slot
      'emergency': this.getCurrentTimeTimeslot() // ASAP - current time slot
    };
    return recommendations[urgency] || 'morning';
  }

  getCurrentTimeTimeslot(): string {
    const now = new Date();
    const currentHour = now.getHours();

    // Map current hour to appropriate timeslot
    if (currentHour >= 3 && currentHour < 6) return 'dawn';        // 3AM-6AM
    if (currentHour >= 6 && currentHour < 12) return 'morning';    // 6AM-12PM (but morning starts at 8AM, so this covers early morning)
    if (currentHour >= 12 && currentHour < 15) return 'noon';      // 12PM-3PM
    if (currentHour >= 15 && currentHour < 17) return 'afternoon'; // 3PM-5PM
    if (currentHour >= 17 && currentHour < 21) return 'evening';   // 5PM-9PM
    if (currentHour >= 21 || currentHour < 3) return 'late-night'; // 9PM-12AM or 12AM-3AM

    // Fallback to morning if somehow no match
    return 'morning';
  }

  onUrgencyChange(urgency: string) {
    // Update urgency
    this.bookingForm.get('urgency')?.setValue(urgency);

    if (urgency === 'emergency') {
      // For ASAP: set date to today and timeslot to current time slot
      const today = new Date().toISOString().split('T')[0];
      this.bookingForm.get('preferredDate')?.setValue(today);

      const currentTimeslot = this.getCurrentTimeTimeslot();
      this.bookingForm.get('preferredTimeslot')?.setValue(currentTimeslot);
    } else {
      // For other urgencies: auto-select recommended timeslot
      const recommendedTimeslot = this.getRecommendedTimeslot(urgency);
      this.bookingForm.get('preferredTimeslot')?.setValue(recommendedTimeslot);
    }
  }

  selectedServicePrice = computed(() => {
    const service = this.selectedService();
    if (!service) return '';

    const minPrice = service.price_min;
    const maxPrice = service.price_max;

    if (minPrice === maxPrice) {
      return `₱${minPrice}`;
    }
    return `₱${minPrice} - ₱${maxPrice}`;
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
    { value: 'automotive', label: 'Automotive', icon: 'car' },
    { value: 'plumbing', label: 'Plumbing', icon: 'water' },
    { value: 'other', label: 'Other', icon: 'construct' }
  ];

  // Urgency levels
  urgencyLevels = [
    { value: 'emergency', label: 'Emergency - ASAP', color: 'danger' },
    { value: 'high', label: 'High - Within 6 hours', color: 'danger' },
    { value: 'medium', label: 'Medium - Within 12 hours', color: 'warning' },
    { value: 'low', label: 'Low - Within 24 hours', color: 'success' }
  ];

  // Timeslots
  timeslots = [
    { value: 'morning', label: 'Morning', range: '8:00 AM - 12:00 PM', icon: 'sunny-outline', after5: false },
    { value: 'noon', label: 'Noon', range: '12:00 PM - 3:00 PM', icon: 'sunny', after5: false },
    { value: 'afternoon', label: 'Afternoon', range: '3:00 PM - 5:00 PM', icon: 'partly-sunny', after5: false },
    { value: 'evening', label: 'Evening', range: '5:00 PM - 9:00 PM', icon: 'moon-outline', after5: true },
    { value: 'late-night', label: 'Late Night', range: '9:00 PM - 12:00 AM', icon: 'moon', after5: true },
    { value: 'overnight', label: 'Overnight', range: '12:00 AM - 3:00 AM', icon: 'cloudy-night', after5: true },
    { value: 'dawn', label: 'Dawn', range: '3:00 AM - 6:00 AM', icon: 'sunrise', after5: true }
  ];

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
    await this.loadUserAddresses();
    const serviceId = this.route.snapshot.paramMap.get('id');
    if (serviceId) {
      await this.loadServiceData(serviceId);
    }

    // Check if returning from address selector with a selected location
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state as { selectedLocation?: GeocodeResult };
    if (state?.selectedLocation) {
      this.onLocationSelected(state.selectedLocation);
    }
  }

  ionViewWillEnter() {
    // Check for selected location in navigation state when returning to this page
    const state = history.state as { selectedLocation?: GeocodeResult };
    if (state?.selectedLocation) {
      this.onLocationSelected(state.selectedLocation);
      // Clear the state after using it
      history.replaceState({}, '');
    }
  }

  private prePopulateUserData() {
    const profile = this.sessionService.profile();
    if (profile) {
      // Pre-populate contact person with user's full name
      this.bookingForm.patchValue({
        contactPerson: profile.full_name
      });

      // Note: phone number is not available in the current UserProfile interface
      // We can add it later if needed
    }
  }

  private async loadUserAddresses() {
    try {
      const result = await this.addressService.getUserAddresses();
      if (result.error) {
        console.error('Error loading user addresses:', result.error);
      } else {
        this.userAddresses.set(result.data || []);
      }
    } catch (error) {
      console.error('Unexpected error loading user addresses:', error);
    }
  }

  async loadServiceData(serviceVariantId: string) {
    try {
      this.isLoading.set(true);
      const serviceData = await this.serviceService.getServiceWithProvider(serviceVariantId);
      if (serviceData) {
        this.selectedService.set(serviceData);
        this.prePopulateFormWithServiceData(serviceData);
      }
    } catch (error) {
      console.error('Error loading service data:', error);
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

    // Pre-populate form with service data
    this.bookingForm.patchValue({
      serviceType: mappedServiceType,
      description: `Service requested: ${serviceData.name}\n\n${serviceData.description || ''}`
    });
  }

  private initializeForm() {
    this.bookingForm = this.formBuilder.group({
      serviceType: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      urgency: ['low', Validators.required],
      preferredDate: ['', Validators.required],
      preferredTimeslot: ['', Validators.required],
      address: ['', Validators.required],
      contactNumber: ['', [Validators.pattern(/^(\+63|0)[9]\d{9}$/)]],
      contactPerson: ['', Validators.required],
      latitude: [null],
      longitude: [null],
      specialInstructions: ['']
    });

    // Initialize currentServiceType signal
    this.currentServiceType.set('');

    // Listen to service type changes to update currentServiceType signal
    this.bookingForm.get('serviceType')?.valueChanges.subscribe(value => {
      this.currentServiceType.set(value || '');
    });

    // Add custom validation for location (either coordinates or manually entered address)
    this.bookingForm.get('address')?.setValidators([
      Validators.required,
      (control) => {
        const address = control.value;
        const latitude = this.bookingForm.get('latitude')?.value;
        const longitude = this.bookingForm.get('longitude')?.value;

        // If coordinates are set, address is valid
        if (latitude && longitude && address) {
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

  // Navigation methods
  nextStep() {
    if (this.bookingForm.valid && this.currentStep() === 1) {
      this.currentStep.set(2);
    }
  }

  previousStep() {
    if (this.currentStep() === 2) {
      this.currentStep.set(1);
    }
  }

  // Camera and file methods
  async takePhoto() {
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
      console.error('Error taking photo:', error);
    }
  }

  async selectFromGallery() {
    try {
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
      console.error('Error selecting from gallery:', error);
    }
  }

  private async addMediaFileFromUri(uri: string, type: 'image' | 'video', name: string) {
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
      console.error('Error adding media file:', error);
    }
  }

  removeMediaFile(fileId: string) {
    this.mediaFiles.update(files => files.filter(f => f.id !== fileId));
  }


  // Submit booking
  async submitBooking() {
    if (this.bookingForm.valid) {
      this.isLoading.set(true);

      try {
        // Combine date and timeslot into a single datetime for submission
        const formValue = this.bookingForm.value;
        const preferredDateTime = this.combineDateAndTimeslot(
          formValue.preferredDate,
          formValue.preferredTimeslot
        );

        const bookingData = {
          ...formValue,
          preferredDateTime, // Combined datetime for backend
          mediaFiles: this.mediaFiles(),
          priceBreakdown: this.priceBreakdown()
        };

        console.log('Submitting booking:', bookingData);

        // Here you would typically call a service to submit the booking
        // For now, just simulate success
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Navigate to success page or booking confirmation
        this.router.navigate(['/c/bookings']);
      } catch (error) {
        console.error('Error submitting booking:', error);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  // Handle description chip click
  addDescriptionChip(chipText: string) {
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

  // Address and location selection methods
  openAddressSelector() {
    // Store current form state in session storage before navigating
    const currentServiceId = this.route.snapshot.paramMap.get('id');
    this.navController.navigateForward('/c/address-selector', {
      state: {
        returnUrl: currentServiceId ? `/c/book/${currentServiceId}` : '/c/book'
      }
    });
  }

  clearSelectedLocation() {
    this.selectedLocation.set(null);
    this.selectedAddressId.set(null);
    this.bookingForm.patchValue({
      address: '',
      latitude: null,
      longitude: null
    });
  }

  selectSavedAddress(address: UserAddress) {
    this.selectedAddressId.set(address.id);
    this.selectedLocation.set({
      lat: address.location.lat,
      lng: address.location.lng,
      address: address.full_address
    });

    // Update form with selected address
    this.bookingForm.patchValue({
      address: address.full_address,
      latitude: address.location.lat,
      longitude: address.location.lng
    });
  }

  onLocationSelected(location: GeocodeResult) {
    this.selectedLocation.set(location);
    this.selectedAddressId.set(null); // Clear saved address selection when manually selecting location

    // Update form with selected location
    this.bookingForm.patchValue({
      address: location.address,
      latitude: location.lat,
      longitude: location.lng
    });
  }

  onAddressInputChange(event: any) {
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
}
