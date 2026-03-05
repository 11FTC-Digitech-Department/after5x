import { Component, OnInit, OnDestroy, input, output, effect, signal, computed, ViewChild } from '@angular/core';
import { devWarn, devError } from '../../utils/logger';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonSearchbar, IonList, IonItem, IonLabel, IonSpinner, IonText, IonIcon, IonButton } from '@ionic/angular/standalone';
import { GoogleMapsService } from '../../services/google-maps.service';
import { GooglePlaceResult, GeocodeResult } from '../../models/address.model';
import { MapComponent, MapCamera } from '../map/map.component';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-map-selector',
  templateUrl: './map-selector.component.html',
  styleUrls: ['./map-selector.component.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    FormsModule,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonSpinner,
    IonText,
    IonIcon,
    IonButton,
    MapComponent,
  ]
})
export class MapSelectorComponent implements OnInit, OnDestroy {
  @ViewChild(MapComponent) mapComponent!: MapComponent;

  // Inputs
  initialLocation = input<{ lat: number; lng: number } | null>(null);
  height = input<string>('300px');

  // Outputs
  locationSelected = output<GeocodeResult>();

  // Signals
  searchQuery = signal('');
  searchResults = signal<GooglePlaceResult[]>([]);
  selectedLocation = signal<GeocodeResult | null>(null);
  isSearching = signal(false);
  isLoading = signal(true);
  locationError = signal<string | null>(null);

  // Computed signals
  mapCenter = computed((): MapCamera => {
    const location = this.selectedLocation();
    if (location) {
      return { lat: location.lat, lng: location.lng, zoom: 15 };
    }
    return { lat: 14.5995, lng: 120.9842, zoom: 15 }; // Manila default
  });

  // Private properties
  private currentMarkerId = 'selected-location';
  private searchSubject = new Subject<string>();

  constructor(private googleMapsService: GoogleMapsService) {
    // Debounce search queries
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      if (query.length >= 3) {
        this.performSearch(query);
      } else {
        this.searchResults.set([]);
      }
    });

    // Initialize map when component is ready
    effect(() => {
      if (this.mapComponent) {
        this.initializeMap();
      }
    });
  }

  async ngOnInit() {
    // Map initialization is handled by the MapComponent
    // We'll set up the initial location after map is ready
  }

  async ngOnDestroy() {
    // Map cleanup is handled by the MapComponent
  }

  private async initializeMap() {
    try {
      this.isLoading.set(true);

      // Get current location or use default
      let center = { lat: 14.5995, lng: 120.9842 }; // Manila coordinates as default

      if (this.initialLocation()) {
        center = this.initialLocation()!;
      } else {
        const currentPosition = await this.googleMapsService.getCurrentPosition();
        if (currentPosition) {
          center = currentPosition;
        }
      }

      const validation = this.googleMapsService.validateLocation(center.lat, center.lng);
      if (!validation.valid) {
        this.selectedLocation.set(null);
        return;
      }

      const geocodeResult = await this.googleMapsService.reverseGeocode(center.lat, center.lng);
      if (geocodeResult) {
        this.selectedLocation.set(geocodeResult);
      }
    } catch (error) {
      devError('Error initializing map:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async setLocation(lat: number, lng: number, address?: string) {
    try {
      const validation = this.googleMapsService.validateLocation(lat, lng, address);
      if (!validation.valid) {
        this.locationError.set(validation.error ?? null);
        return;
      }

      this.locationError.set(null);

      const geocodeResult = await this.googleMapsService.reverseGeocode(lat, lng);
      if (geocodeResult) {
        this.selectedLocation.set(geocodeResult);
        this.locationSelected.emit(geocodeResult);

        if (this.mapComponent && this.mapComponent.mapInstance()) {
          await this.mapComponent.mapInstance()?.setCamera({
            coordinate: { lat, lng },
            zoom: 15,
          });
        }
      }
    } catch (error) {
      devError('Error setting location:', error);
    }
  }

  onSearchInput(event: any) {
    const query = event.target.value || '';
    this.searchQuery.set(query);
    this.locationError.set(null);
    this.searchSubject.next(query);
  }

  private async performSearch(query: string) {
    this.isSearching.set(true);
    try {
      const results = await this.googleMapsService.searchPlaces(query);
      this.searchResults.set(results);
    } catch (error) {
      devError('Error performing search:', error);
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  async selectPlace(place: GooglePlaceResult) {
    try {
      if (place.place_id.startsWith('mock_')) {
        devWarn('Mock place selected - using current location as placeholder');
        const currentLocation = this.selectedLocation();
        if (currentLocation) {
          this.searchQuery.set('');
          this.searchResults.set([]);
          return;
        }
      }

      const placeDetails = await this.googleMapsService.getPlaceDetails(place.place_id);
      if (placeDetails) {
        await this.setLocation(placeDetails.lat, placeDetails.lng, placeDetails.address);
        this.searchQuery.set('');
        this.searchResults.set([]);
      }
    } catch (error) {
      devError('Error selecting place:', error);
    }
  }

  async useCurrentLocation() {
    try {
      this.locationError.set(null);
      const currentPosition = await this.googleMapsService.getCurrentPosition();
      if (currentPosition) {
        await this.setLocation(currentPosition.lat, currentPosition.lng);
      }
    } catch (error) {
      devError('Error getting current location:', error);
    }
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.locationError.set(null);
  }


  async onMapReady() {
    // Map is now ready, initialize the location
    await this.initializeMap();
  }

  async onMapClick(geocodeResult: GeocodeResult) {
    await this.setLocation(geocodeResult.lat, geocodeResult.lng, geocodeResult.address);
  }

  onSelectionRejected(error: string) {
    this.locationError.set(error);
    this.selectedLocation.set(null);
  }
}