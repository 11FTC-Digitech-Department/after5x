import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonBackButton,
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonSearchbar,
  NavController
} from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { MapComponent } from '@core/components/map/map.component';
import { AddressService } from '@core/supabase/address.service';
import { GoogleMapsService } from '@core/services/google-maps.service';
import { UserAddress, GeocodeResult, GooglePlaceResult } from '@core/models/address.model';

// Navigation state interface for address selector
interface AddressSelectorNavigationState {
  returnUrl?: string;
  mode?: 'create' | 'edit';
  existingAddress?: UserAddress;
}

@Component({
  selector: 'app-address-selector',
  templateUrl: './address-selector.page.html',
  styleUrls: ['./address-selector.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonBackButton,
    IonText,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    IonSearchbar,
    MapComponent
  ]
})
export class AddressSelectorPage implements ViewWillEnter, OnInit, OnDestroy {
  private navController = inject(NavController);
  private addressService = inject(AddressService);
  private googleMapsService = inject(GoogleMapsService);

  // State
  userAddresses = signal<UserAddress[]>([]);
  selectedLocation = signal<GeocodeResult | null>(null);
  isLoading = signal(false);
  showMap = signal(false);
  hasLoaded = signal(false);
  isGettingLocation = signal(false);
  currentLocation = signal<{ lat: number; lng: number } | null>(null);
  locationError = signal<string | null>(null);

  // Search autocomplete state
  searchQuery = signal('');
  searchResults = signal<GooglePlaceResult[]>([]);
  isSearching = signal(false);
  showSearchResults = signal(false);
  isSelectingPlace = signal(false);

  // Edit mode state
  private navigationState: AddressSelectorNavigationState | null = null;

  // RxJS for debouncing
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit() {
    // Set up debounced search
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        this.performSearch(query);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewWillEnter() {
    // Capture navigation state
    this.navigationState = history.state as AddressSelectorNavigationState;

    // If editing an address with existing location, pre-center the map
    if (this.navigationState?.existingAddress?.hasValidLocation) {
      const existingAddr = this.navigationState.existingAddress;
      if (existingAddr.location.lat !== 0 || existingAddr.location.lng !== 0) {
        this.currentLocation.set({
          lat: existingAddr.location.lat,
          lng: existingAddr.location.lng
        });
        // Pre-select the location
        this.selectedLocation.set({
          lat: existingAddr.location.lat,
          lng: existingAddr.location.lng,
          address: existingAddr.full_address
        });
      }
    }

    // Only load addresses if not already loaded
    if (!this.hasLoaded()) {
      this.loadUserAddresses();
    }
  }

  private async loadUserAddresses() {
    this.isLoading.set(true);

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );

      const result = await Promise.race([
        this.addressService.getUserAddresses(),
        timeoutPromise
      ]) as any;

      if (result.error) {
        console.error('Error loading user addresses:', result.error);
        this.userAddresses.set([]);
      } else {
        this.userAddresses.set(result.data || []);
      }
      this.hasLoaded.set(true);
    } catch (error) {
      console.error('Unexpected error loading user addresses:', error);
      this.userAddresses.set([]);
      this.hasLoaded.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectSavedAddress(address: UserAddress) {
    // Validate coordinates before selection
    if (!address.hasValidLocation || (address.location.lat === 0 && address.location.lng === 0)) {
      this.locationError.set('This address has invalid location data. Please select a different address or use the map to update it.');
      return;
    }

    // Clear any previous error
    this.locationError.set(null);

    const location: GeocodeResult = {
      lat: address.location.lat,
      lng: address.location.lng,
      address: address.full_address
    };
    this.confirmSelection(location);
  }

  onLocationSelected(location: GeocodeResult) {
    this.selectedLocation.set(location);
  }

  async useCurrentLocation() {
    this.isGettingLocation.set(true);
    this.locationError.set(null);

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Location request timeout')), 15000)
      );

      const position = await Promise.race([
        this.googleMapsService.getCurrentPosition(),
        timeoutPromise
      ]) as any;

      if (!position) {
        this.locationError.set('Unable to get your location. Please check your location settings.');
        return;
      }

      this.currentLocation.set(position);

      // Reverse geocode to get the address with timeout
      const geocodeTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Geocode timeout')), 10000)
      );

      const geocodeResult = await Promise.race([
        this.googleMapsService.reverseGeocode(position.lat, position.lng),
        geocodeTimeoutPromise
      ]).catch(() => null) as any;

      if (geocodeResult) {
        this.selectedLocation.set(geocodeResult);
        this.showMap.set(true);
      } else {
        // Still show map with location even if reverse geocode fails
        this.selectedLocation.set({
          lat: position.lat,
          lng: position.lng,
          address: `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
        });
        this.showMap.set(true);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      this.locationError.set('Failed to get your location. Please try again or select manually.');
    } finally {
      this.isGettingLocation.set(false);
    }
  }

  // Search autocomplete methods
  onSearchInput(event: any) {
    const query = event.detail.value || '';
    this.searchQuery.set(query);

    if (query.length >= 3) {
      this.showSearchResults.set(true);
      this.searchSubject.next(query);
    } else {
      this.searchResults.set([]);
      this.showSearchResults.set(false);
    }
  }

  private async performSearch(query: string) {
    if (query.length < 3) {
      this.searchResults.set([]);
      return;
    }

    this.isSearching.set(true);

    try {
      // Get current location for better search results (if available)
      const currentLoc = this.currentLocation();

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Search timeout')), 10000)
      );

      const results = await Promise.race([
        this.googleMapsService.searchPlaces(query, currentLoc || undefined),
        timeoutPromise
      ]) as any;

      this.searchResults.set(results || []);
    } catch (error) {
      console.error('Error searching places:', error);
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  async selectSearchResult(place: GooglePlaceResult) {
    this.isSelectingPlace.set(true);
    this.showSearchResults.set(false);
    this.searchQuery.set(place.description);

    try {
      // Get place details to get coordinates with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Place details request timeout')), 10000)
      );

      const placeDetails = await Promise.race([
        this.googleMapsService.getPlaceDetails(place.place_id),
        timeoutPromise
      ]) as any;

      if (placeDetails) {
        this.currentLocation.set({ lat: placeDetails.lat, lng: placeDetails.lng });
        this.selectedLocation.set(placeDetails);
        this.showMap.set(true);
      } else {
        this.locationError.set('Unable to get location details. Please try again.');
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      this.locationError.set('Failed to get location details. Please try again.');
    } finally {
      this.isSelectingPlace.set(false);
    }
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showSearchResults.set(false);
  }

  onSearchFocus() {
    if (this.searchQuery().length >= 3 && this.searchResults().length > 0) {
      this.showSearchResults.set(true);
    }
  }

  onSearchBlur() {
    // Delay hiding results to allow click events to fire
    setTimeout(() => {
      this.showSearchResults.set(false);
    }, 200);
  }

  closeMapSelector() {
    this.showMap.set(false);
    this.selectedLocation.set(null);
    this.currentLocation.set(null);
    this.clearSearch();
  }

  confirmMapSelection() {
    const location = this.selectedLocation();
    if (location) {
      this.confirmSelection(location);
    }
  }

  private confirmSelection(location: GeocodeResult) {
    // Get the return URL and existing address from navigation state
    const returnUrl = this.navigationState?.returnUrl || '/c/book';
    const existingAddress = this.navigationState?.existingAddress;

    // Navigate back with the selected location and existing address data (for edit mode)
    this.navController.navigateBack(returnUrl, {
      state: {
        selectedLocation: location,
        existingAddress: existingAddress // Pass back for edit mode
      }
    });
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

  getInitialMapLocation(): { lat: number; lng: number } | null {
    const defaultAddress = this.userAddresses().find(addr => addr.is_default);
    if (defaultAddress) {
      return { lat: defaultAddress.location.lat, lng: defaultAddress.location.lng };
    }
    return { lat: 14.5995, lng: 120.9842 }; // Manila default
  }

  getMapCenter(): { lat: number; lng: number; zoom?: number } {
    // Prioritize current location if available
    const currentLoc = this.currentLocation();
    if (currentLoc) {
      return { lat: currentLoc.lat, lng: currentLoc.lng, zoom: 17 };
    }

    const defaultAddress = this.userAddresses().find(addr => addr.is_default);
    if (defaultAddress) {
      return { lat: defaultAddress.location.lat, lng: defaultAddress.location.lng, zoom: 15 };
    }
    return { lat: 14.5995, lng: 120.9842, zoom: 15 }; // Manila default
  }
}
