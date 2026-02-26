import { Component, ElementRef, ViewChild, OnInit, OnDestroy, AfterViewInit, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonSpinner, IonText, IonIcon } from '@ionic/angular/standalone';
import { GoogleMap } from '@capacitor/google-maps';
import { environment } from 'src/environments/environment';
import { GoogleMapsService } from '@core/services/google-maps.service';
import { GeocodeResult } from '@core/models/address.model';
import { devLog, devWarn, devError } from '@core/utils/logger';

export interface MapCamera {
  lat: number;
  lng: number;
  zoom?: number;
}

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule, IonSpinner, IonText, IonIcon]
})
export class MapComponent implements OnInit, OnDestroy, AfterViewInit {
  // Inputs
  center = input<MapCamera>({ lat: 14.5995, lng: 120.9842, zoom: 15 });
  height = input<string>('300px');
  initialMarker = input<{ lat: number; lng: number } | null>(null);

  // Outputs
  mapReady = output<void>();
  locationSelected = output<GeocodeResult>();

  // ViewChild for map container - required by Capacitor Google Maps
  @ViewChild('mapContainer')
  mapContainerRef!: ElementRef<HTMLElement>;

  // Signals
  isLoading = signal(true);
  hasError = signal(false);
  errorMessage = signal('');
  mapInstance = signal<GoogleMap | null>(null);
  currentMarkerId = signal<string | null>(null);

  // Unique map ID to prevent conflicts
  readonly mapId = 'map-' + Math.random().toString(36).substring(2, 11);

  // Private properties
  private googleMapsService = inject(GoogleMapsService);

  constructor() {}

  async ngOnInit() {
    // Component initialization - map creation moved to AfterViewInit
  }

  async ngAfterViewInit() {
    this.initializeMap();
  }

  async ngOnDestroy() {
    // Clean up map instance
    if (this.mapInstance()) {
      try {
        await this.mapInstance()?.destroy();
        this.mapInstance.set(null);
      } catch (error) {
        devError('Error destroying map:', error);
      }
    }
  }

  private async initializeMap() {
    try {
      this.isLoading.set(true);

      // Wait for the capacitor-google-map custom element to be registered
      if (customElements.get('capacitor-google-map') === undefined) {
        await customElements.whenDefined('capacitor-google-map');
      }

      const element = this.mapContainerRef?.nativeElement;
      if (!element) {
        throw new Error('Map container element not found');
      }

      // Wait for element to have actual dimensions (critical for Android)
      // On Android, the native map uses these dimensions at creation time.
      // If dimensions are 0x0, the map will be invisible (blue screen).
      await this.waitForElementDimensions(element);

      // Set the element ID to match the map ID before creating
      element.id = this.mapId;

      this.mapInstance.set(await GoogleMap.create({
        id: this.mapId,
        element: element,
        apiKey: environment.googleMaps.apiKey,
        forceCreate: true, // Force recreation if map with this ID exists
        config: {
          center: { lat: this.center().lat, lng: this.center().lng },
          zoom: this.center()?.zoom ?? 15,
        },
      }));

      devLog('Map initialized with dimensions:', element.getBoundingClientRect());
      
      // Add initial marker if provided
      const initialMarkerPos = this.initialMarker();
      if (initialMarkerPos) {
        const markerId = await this.mapInstance()?.addMarker({
          coordinate: { lat: initialMarkerPos.lat, lng: initialMarkerPos.lng },
          draggable: true,
        });
        this.currentMarkerId.set(markerId ?? null);
      }

      await this.mapInstance()?.setOnMapClickListener(async (event) => {
        const lat = event.latitude;
        const lng = event.longitude;

        // Remove the current marker if it exists
        if (this.currentMarkerId()) {
          await this.mapInstance()?.removeMarker(this.currentMarkerId()!);
        }

        // Add a new marker at the clicked position
        const newMarkerId = await this.mapInstance()?.addMarker({
          coordinate: { lat, lng },
          draggable: true,
        });

        // Store the new marker ID for future removal
        this.currentMarkerId.set(newMarkerId ?? null);

        // Reverse geocode the coordinates to get the address
        try {
          const geocodeResult = await this.googleMapsService.reverseGeocode(lat, lng);
          if (geocodeResult) {
            this.locationSelected.emit(geocodeResult);
          }
        } catch (error) {
          devError('Error reverse geocoding location:', error);
        }

        // Center the camera on the clicked position
        await this.mapInstance()?.setCamera({
          coordinate: { lat, lng },
          zoom: 15,
        });
      });

    } catch (error) {
      devError('Error initializing map:', error);
      this.hasError.set(true);
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to initialize map');
      this.mapReady.emit();
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Wait for element to have computed dimensions.
   * On Android, the native map uses these dimensions at creation time.
   * If dimensions are 0x0, the map will be invisible.
   */
  private waitForElementDimensions(element: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const checkDimensions = () => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      // If already has dimensions, resolve immediately
      if (checkDimensions()) {
        resolve();
        return;
      }

      // Use ResizeObserver to wait for dimensions
      const observer = new ResizeObserver(() => {
        if (checkDimensions()) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(element);

      // Fallback timeout to prevent infinite wait
      setTimeout(() => {
        observer.disconnect();
        devWarn('Map element dimension timeout - proceeding anyway');
        resolve();
      }, 2000);
    });
  }
}