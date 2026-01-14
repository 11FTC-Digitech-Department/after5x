import { Component, ElementRef, ViewChild, OnInit, OnDestroy, AfterViewInit, input, output, signal, viewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonSpinner, IonText, IonIcon } from '@ionic/angular/standalone';
import { GoogleMap, Marker } from '@capacitor/google-maps';
import { environment } from 'src/environments/environment';
import { GoogleMapsService } from '@core/services/google-maps.service';
import { GeocodeResult } from '@core/models/address.model';

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

  // Outputs
  mapReady = output<void>();
  locationSelected = output<GeocodeResult>();

  // Signals
  isLoading = signal(true);
  hasError = signal(false);
  errorMessage = signal('');
  mapInstance = signal<GoogleMap | null>(null);
  currentMarkerId = signal<string | null>(null);
  mapContainerRef = viewChild<ElementRef>('mapContainer');

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
        console.error('Error destroying map:', error);
      }
    }
  }

  private async initializeMap() {
    try {
      this.isLoading.set(true);
    
      this.mapInstance.set(await GoogleMap.create({
        id: 'map',
        element: this.mapContainerRef()?.nativeElement ?? undefined,
        apiKey: environment.googleMaps.apiKey,
        config: {
          center: { lat: this.center().lat, lng: this.center().lng },
          zoom: this.center()?.zoom ?? 15,  
        }, 
      }));

      console.log(this.mapInstance());
      
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
          console.error('Error reverse geocoding location:', error);
        }

        // Center the camera on the clicked position
        await this.mapInstance()?.setCamera({
          coordinate: { lat, lng },
          zoom: 15,
        });
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      this.hasError.set(true);
      this.errorMessage.set(error instanceof Error ? error.message : 'Failed to initialize map');
      this.mapReady.emit();
    } finally {
      this.isLoading.set(false);
    }
  }
}