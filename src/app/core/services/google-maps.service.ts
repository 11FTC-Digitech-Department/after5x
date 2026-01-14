import { Injectable, inject } from '@angular/core';
import { GoogleMap } from '@capacitor/google-maps';
import { Geolocation } from '@capacitor/geolocation';
import { Platform } from '@ionic/angular';
import { GooglePlaceResult, GeocodeResult } from '../models/address.model';

@Injectable({
  providedIn: 'root',
})
export class GoogleMapsService {
  private platform = inject(Platform);

  /**
   * Initialize a Google Map in a container element
   */
  async createMap(
    element: HTMLElement,
    center: { lat: number; lng: number },
    zoom: number = 15
  ): Promise<GoogleMap | null> {
    try {
      if (!this.platform.is('capacitor')) {
        console.warn('Google Maps is only supported in Capacitor apps');
        return null;
      }

      // Generate a unique ID for this map instance
      const mapId = 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      const newMap = await GoogleMap.create({
        id: mapId,
        element: element,
        apiKey: 'AIzaSyC6UXRkbdChigjhccoNb4WOWptb6IWLLg4',
        config: {
          center,
          zoom,
          styles: [], // You can add custom map styles here
        },
      });

      return newMap;
    } catch (error) {
      console.error('Error creating map:', error);
      return null;
    }
  }

  /**
   * Destroy a map instance
   */
  async destroyMap(mapInstance: GoogleMap): Promise<void> {
    try {
      if (mapInstance) {
        await mapInstance.destroy();
      }
    } catch (error) {
      console.error('Error destroying map:', error);
    }
  }

  /**
   * Add a marker to the map
   */
  async addMarker(
    mapInstance: GoogleMap,
    position: { lat: number; lng: number },
    title?: string,
    draggable: boolean = true
  ): Promise<string | null> {
    try {
      if (!mapInstance) {
        console.error('Map instance not provided');
        return null;
      }

      const markerId = await mapInstance.addMarker({
        coordinate: position,
        title,
        draggable,
      });

      return markerId;
    } catch (error) {
      console.error('Error adding marker:', error);
      return null;
    }
  }

  /**
   * Remove a marker from the map
   */
  async removeMarker(mapInstance: GoogleMap, markerId: string): Promise<void> {
    try {
      if (!mapInstance) return;

      await mapInstance.removeMarker(markerId);
    } catch (error) {
      console.error('Error removing marker:', error);
    }
  }

  /**
   * Move camera to a specific position
   */
  async moveCamera(mapInstance: GoogleMap, position: { lat: number; lng: number }, zoom?: number): Promise<void> {
    try {
      if (!mapInstance) return;

      await mapInstance.setCamera({
        coordinate: position,
        zoom,
      });
    } catch (error) {
      console.error('Error moving camera:', error);
    }
  }

  /**
   * Get current device location
   */
  async getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
    try {
      // Check and request location permissions if needed
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location === 'denied' || permissions.location === 'prompt') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          console.error('Location permission denied');
          return null;
        }
      }

      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      return {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting current position:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    try {
      // Using Google Maps Geocoding API
      const apiKey = 'AIzaSyC6UXRkbdChigjhccoNb4WOWptb6IWLLg4';
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat,
          lng,
          address: result.formatted_address,
        };
      }

      return null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }

  /**
   * Search for places using Google Places API
   */
  async searchPlaces(query: string, location?: { lat: number; lng: number }): Promise<GooglePlaceResult[]> {
    // Check if running in Capacitor (where Google APIs work)
    if (!this.platform.is('capacitor')) {
      console.warn('Places API search is only available in Capacitor apps due to CORS restrictions');
      // Return mock results for development
      if (query.length >= 3) {
        return [
          {
            place_id: 'mock_' + query,
            description: `${query} (Mock Result - Only works in Capacitor)`,
            structured_formatting: {
              main_text: query,
              secondary_text: 'Mock Location'
            }
          }
        ];
      }
      return [];
    }

    try {
      const apiKey = 'AIzaSyC6UXRkbdChigjhccoNb4WOWptb6IWLLg4';
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&types=address`;

      if (location) {
        url += `&location=${location.lat},${location.lng}&radius=50000`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        return data.predictions.map((prediction: any) => ({
          place_id: prediction.place_id,
          description: prediction.description,
          structured_formatting: prediction.structured_formatting,
        }));
      }

      return [];
    } catch (error) {
      console.error('Error searching places:', error);
      return [];
    }
  }

  /**
   * Get place details from place ID
   */
  async getPlaceDetails(placeId: string): Promise<GeocodeResult | null> {
    // Check if running in Capacitor (where Google APIs work)
    if (!this.platform.is('capacitor')) {
      console.warn('Place details API is only available in Capacitor apps due to CORS restrictions');
      // Return mock result for development
      return {
        lat: 14.5995,
        lng: 120.9842,
        address: 'Mock Address - Only works in Capacitor'
      };
    }

    try {
      const apiKey = 'AIzaSyC6UXRkbdChigjhccoNb4WOWptb6IWLLg4';
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=geometry,formatted_address`
      );

      const data = await response.json();

      if (data.status === 'OK') {
        const result = data.result;
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          address: result.formatted_address,
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Note: Event listeners are not implemented in this simplified version
   * For production, you would need to implement proper event handling
   * based on the specific Capacitor Google Maps API version
   */
}