import { Injectable, inject } from '@angular/core';
import { GoogleMap } from '@capacitor/google-maps';
import { devError, devWarn } from '../utils/logger';
import { Geolocation } from '@capacitor/geolocation';
import { Platform } from '@ionic/angular';
import { GooglePlaceResult, GeocodeResult } from '../models/address.model';
import { environment } from '../../../environments/environment';
import { CapacitorHttp } from '@capacitor/core';

/**
 * Quezon City, Philippines bounds for address selection.
 * OSM admin boundary bbox, clipped east at Marikina River (121.06) to exclude Marikina.
 */
export const QC_BOUNDS = {
  north: 14.776,
  south: 14.589,
  east: 121.06,
  west: 120.99,
} as const;

export const QC_BOUNDS_ERROR =
  'This location is outside our service area (Quezon City). Please choose an address within Quezon City.';

/** Cities/locality names that are within the service area. Add more to expand coverage. */
export const ALLOWED_LOCALITIES = ['Quezon City'] as const;

@Injectable({
  providedIn: 'root',
})
export class GoogleMapsService {
  private platform = inject(Platform);

  /** Check if coordinates are within QC bounds (rectangle) */
  isWithinQCBounds(lat: number, lng: number): boolean {
    return (
      lat >= QC_BOUNDS.south &&
      lat <= QC_BOUNDS.north &&
      lng >= QC_BOUNDS.west &&
      lng <= QC_BOUNDS.east
    );
  }

  /**
   * Check if address indicates location is in an allowed locality.
   * Primary validation when geocoded address is available.
   */
  isAddressInQuezonCity(address: string): boolean {
    if (!address) return false;
    const upper = address.toUpperCase();
    return ALLOWED_LOCALITIES.some(loc => upper.includes(loc.toUpperCase()));
  }

  /**
   * Validate location. Uses address (from geocode) when provided for accurate city check.
   * Falls back to bounds when address not available (e.g. saved address).
   */
  validateLocation(
    lat: number,
    lng: number,
    address?: string
  ): { valid: boolean; error?: string } {
    if (address) {
      if (this.isAddressInQuezonCity(address)) return { valid: true };
      return { valid: false, error: QC_BOUNDS_ERROR };
    }
    if (this.isWithinQCBounds(lat, lng)) return { valid: true };
    return { valid: false, error: QC_BOUNDS_ERROR };
  }

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
        devWarn('Google Maps is only supported in Capacitor apps');
        return null;
      }

      // Generate a unique ID for this map instance
      const mapId = 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      const newMap = await GoogleMap.create({
        id: mapId,
        element: element,
        apiKey: environment.googleMaps.apiKey,
        config: {
          center,
          zoom,
          styles: [], // You can add custom map styles here
        },
      });

      return newMap;
    } catch (error) {
      devError('Error creating map:', error);
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
      devError('Error destroying map:', error);
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
        devError('Map instance not provided');
        return null;
      }

      const markerId = await mapInstance.addMarker({
        coordinate: position,
        title,
        draggable,
      });

      return markerId;
    } catch (error) {
      devError('Error adding marker:', error);
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
      devError('Error removing marker:', error);
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
      devError('Error moving camera:', error);
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
          devError('Location permission denied');
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
      devError('Error getting current position:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    try {
      // Using Google Maps Geocoding API
      const apiKey = environment.googleMaps.apiKey;
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
      devError('Error reverse geocoding:', error);
      return null;
    }
  }

  /** Center of Quezon City for Places Autocomplete bounds */
  private readonly QC_CENTER = { lat: 14.682, lng: 121.025 };

  /**
   * Search for places using Google Places API.
   * Restricted to Quezon City, Philippines.
   */
  async searchPlaces(query: string): Promise<GooglePlaceResult[]> {
    try {
      const apiKey = environment.googleMaps.apiKey;
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(query)}&key=${apiKey}&types=address` +
        `&location=${this.QC_CENTER.lat},${this.QC_CENTER.lng}&radius=20000` +
        `&strictbounds=true&components=country:ph`;

      const response = await CapacitorHttp.get({ url });
      
      if (response.status === 200) {
        const data = await response.data;
       
        return data.predictions.map((prediction: any) => ({
          place_id: prediction.place_id,
          description: prediction.description,
          structured_formatting: prediction.structured_formatting,
        }));
      }

      return [];
    } catch (error) {
      devError('Error searching places:', error);
      return [];
    }
  }

  /**
   * Get place details from place ID
   */
  async getPlaceDetails(placeId: string): Promise<GeocodeResult | null> {
    // Check if running in Capacitor (where Google APIs work)
    if (!this.platform.is('capacitor')) {
      devWarn('Place details API is only available in Capacitor apps due to CORS restrictions');
      // Return mock result for development
      return {
        lat: 14.5995,
        lng: 120.9842,
        address: 'Mock Address - Only works in Capacitor'
      };
    }

    try {
      const apiKey = environment.googleMaps.apiKey;
      const response = await CapacitorHttp.get({
        url: `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=geometry,formatted_address`
      });

      if (response.status === 200) {
        const data = await response.data;
        
        const result = data.result;
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          address: result.formatted_address,
        };
      }

      return null;
    } catch (error) {
      devError('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Note: Event listeners are not implemented in this simplified version
   * For production, you would need to implement proper event handling
   * based on the specific Capacitor Google Maps API version
   */
}