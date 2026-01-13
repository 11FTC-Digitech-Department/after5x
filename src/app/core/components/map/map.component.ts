import { Component, ElementRef, ViewChild, OnInit, OnDestroy, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { GoogleMap } from '@capacitor/google-maps';

export interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  title?: string;
  draggable?: boolean;
}

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
  imports: [CommonModule, ]
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  // Inputs
  center = input<MapCamera>({ lat: 14.5995, lng: 120.9842, zoom: 15 });
  markers = input<MapMarker[]>([]);
  height = input<string>('300px');

  // Outputs
  mapReady = output<void>();
  mapClick = output<{ lat: number; lng: number }>();
  markerDragEnd = output<{ markerId: string; position: { lat: number; lng: number } }>();

  // Signals
  isLoading = signal(true);


  // Private properties
  private mapInstance: GoogleMap | null = null;
  private markerIds = new Map<string, string>(); // Maps our marker IDs to Google Maps marker IDs

  // Getter for template access
  get hasMapInstance(): boolean {
    return this.mapInstance !== null;
  }

  constructor() {
    // React to marker changes
  }

  async ngOnInit() {
    await this.initializeMap();
  }

  async ngOnDestroy() {

  }

  private async initializeMap() {
    try {
      this.isLoading.set(true);

      const center = this.center();
      const mapInstance = await GoogleMap.create({
        id: 'map',
        element: this.mapContainer?.nativeElement,
        apiKey: 'AIzaSyC6UXRkbdChigjhccoNb4WOWptb6IWLLg4',
        config: {
          center: { lat: center.lat, lng: center.lng },
          zoom: center.zoom || 15,
        },
      });

      if (mapInstance) {
        this.mapInstance = mapInstance;
        await this.mapInstance.addMarker({
          coordinate: { lat: center.lat, lng: center.lng },
          draggable: false
        });
        this.mapReady.emit();
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async addMarkers(markers: MapMarker[]) {
    if (!this.mapInstance) return;

    // Clear existing markers
    await this.clearMarkers();

    // Add new markers using Capacitor's addMarker method
    for (const marker of markers) {
      try {
        const markerId = await this.mapInstance.addMarker({
          coordinate: marker.position,
          title: marker.title,
          draggable: marker.draggable ?? true
        });

        if (markerId) {
          this.markerIds.set(marker.id, markerId);
        }
      } catch (error) {
        console.error('Error adding marker:', error);
      }
    }
  }

  private async clearMarkers() {
    if (!this.mapInstance) return;

    for (const googleMarkerId of this.markerIds.values()) {
      try {
        await this.mapInstance.removeMarker(googleMarkerId);
      } catch (error) {
        console.error('Error removing marker:', error);
      }
    }
    this.markerIds.clear();
  }

  async moveCamera(camera: MapCamera) {
    if (this.mapInstance) {
      try {
        await this.mapInstance.setCamera({
          coordinate: { lat: camera.lat, lng: camera.lng },
          zoom: camera.zoom
        });
      } catch (error) {
        console.error('Error moving camera:', error);
      }
    }
  }

  async addMarker(marker: MapMarker) {
    if (this.mapInstance) {
      try {
        const markerId = await this.mapInstance.addMarker({
          coordinate: marker.position,
          title: marker.title,
          draggable: marker.draggable ?? true
        });

        if (markerId) {
          this.markerIds.set(marker.id, markerId);
        }
      } catch (error) {
        console.error('Error adding marker:', error);
      }
    }
  }

  async removeMarker(markerId: string) {
    if (this.mapInstance && this.markerIds.has(markerId)) {
      const googleMarkerId = this.markerIds.get(markerId)!;
      try {
        await this.mapInstance.removeMarker(googleMarkerId);
        this.markerIds.delete(markerId);
      } catch (error) {
        console.error('Error removing marker:', error);
      }
    }
  }

  async updateMarker(markerId: string, position: { lat: number; lng: number }) {
    if (this.mapInstance && this.markerIds.has(markerId)) {
      const googleMarkerId = this.markerIds.get(markerId)!;

      try {
        // Remove old marker
        await this.mapInstance.removeMarker(googleMarkerId);

        // Add new marker at updated position
        const newGoogleMarkerId = await this.mapInstance.addMarker({
          coordinate: position,
          draggable: true // Keep draggable for updated markers
        });

        if (newGoogleMarkerId) {
          this.markerIds.set(markerId, newGoogleMarkerId);
        }
      } catch (error) {
        console.error('Error updating marker:', error);
      }
    }
  }

  private async updateMarkers(newMarkers: MapMarker[]) {
    if (!this.mapInstance) return;

    const currentMarkerIds = new Set(this.markerIds.keys());
    const newMarkerIds = new Set(newMarkers.map(m => m.id));

    // Remove markers that are no longer needed
    for (const markerId of currentMarkerIds) {
      if (!newMarkerIds.has(markerId)) {
        const googleMarkerId = this.markerIds.get(markerId)!;
        try {
          await this.mapInstance.removeMarker(googleMarkerId);
          this.markerIds.delete(markerId);
        } catch (error) {
          console.error('Error removing marker:', error);
        }
      }
    }

    // Add or update markers
    for (const marker of newMarkers) {
      if (this.markerIds.has(marker.id)) {
        // Update existing marker position
        const googleMarkerId = this.markerIds.get(marker.id)!;
        try {
          await this.mapInstance.removeMarker(googleMarkerId);
          const newGoogleMarkerId = await this.mapInstance.addMarker({
            coordinate: marker.position,
            title: marker.title,
            draggable: marker.draggable ?? true
          });
          if (newGoogleMarkerId) {
            this.markerIds.set(marker.id, newGoogleMarkerId);
          }
        } catch (error) {
          console.error('Error updating marker:', error);
        }
      } else {
        // Add new marker
        try {
          const googleMarkerId = await this.mapInstance.addMarker({
            coordinate: marker.position,
            title: marker.title,
            draggable: marker.draggable ?? true
          });
          if (googleMarkerId) {
            this.markerIds.set(marker.id, googleMarkerId);
          }
        } catch (error) {
          console.error('Error adding marker:', error);
        }
      }
    }
  }
}