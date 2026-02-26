import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { UserAddress, CreateAddressRequest, UpdateAddressRequest } from '../models/address.model';
import { devLog } from '../utils/logger';
import { PostgrestError } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  private supabaseService = inject(SupabaseService);

  /**
   * Get all addresses for the current user
   */
  async getUserAddresses(): Promise<{ data: UserAddress[] | null; error: string | null }> {
    try {
      const { data: { user } } = await this.supabaseService.client.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      const { data, error } = await this.supabaseService.client
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: error.message };
      }

      // Read lat/lng directly from columns instead of parsing geography
      const addresses: UserAddress[] = data?.map((address: any) => {
        const lat = address.latitude;
        const lng = address.longitude;
        const isValid = this.isValidCoordinate(lat, lng);

        devLog('[AddressService] Mapping address:', {
          id: address.id,
          label: address.label,
          latitude: lat,
          longitude: lng,
          isValid,
          rawData: { latitude: address.latitude, longitude: address.longitude }
        });

        return {
          id: address.id,
          user_id: address.user_id,
          label: address.label || 'Home',
          is_default: address.is_default || false,
          full_address: address.full_address,
          unit_details: address.unit_details || undefined,
          access_instructions: address.access_instructions || undefined,
          has_parking: address.has_parking || false,
          parking_instructions: address.parking_instructions || undefined,
          location: isValid ? { lat, lng } : { lat: 0, lng: 0 },
          hasValidLocation: isValid,
          created_at: address.created_at || '',
          updated_at: address.updated_at || ''
        };
      }) || [];

      return { data: addresses, error: null };
    } catch (error) {
      return { data: null, error: 'Failed to fetch addresses' };
    }
  }

  /**
   * Get a specific address by ID
   */
  async getAddressById(addressId: string): Promise<{ data: UserAddress | null; error: string | null }> {
    try {
      const { data: { user } } = await this.supabaseService.client.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      const { data, error } = await this.supabaseService.client
        .from('user_addresses')
        .select('*')
        .eq('id', addressId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (!data) {
        return { data: null, error: 'Address not found' };
      }

      const addressData = data as any;
      const lat = addressData.latitude;
      const lng = addressData.longitude;
      const isValid = this.isValidCoordinate(lat, lng);

      const address: UserAddress = {
        id: addressData.id,
        user_id: addressData.user_id,
        label: addressData.label || 'Home',
        is_default: addressData.is_default || false,
        full_address: addressData.full_address,
        unit_details: addressData.unit_details || undefined,
        access_instructions: addressData.access_instructions || undefined,
        has_parking: addressData.has_parking || false,
        parking_instructions: addressData.parking_instructions || undefined,
        location: isValid ? { lat, lng } : { lat: 0, lng: 0 },
        hasValidLocation: isValid,
        created_at: addressData.created_at || '',
        updated_at: addressData.updated_at || ''
      };

      return { data: address, error: null };
    } catch (error) {
      return { data: null, error: 'Failed to fetch address' };
    }
  }

  /**
   * Create a new address
   */
  async createAddress(addressData: CreateAddressRequest): Promise<{ data: UserAddress | null; error: string | null }> {
    try {
      const { data: { user } } = await this.supabaseService.client.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      // Validate coordinates before saving
      if (!this.isValidCoordinate(addressData.latitude, addressData.longitude)) {
        return { data: null, error: 'Invalid location coordinates. Please select a valid location on the map.' };
      }

      // If this is set as default, unset other defaults first
      if (addressData.is_default) {
        await this.unsetDefaultAddresses(user.id);
      }

      const { data, error } = await this.supabaseService.client
        .from('user_addresses')
        .insert({
          user_id: user.id,
          label: addressData.label,
          is_default: addressData.is_default || false,
          full_address: addressData.full_address,
          unit_details: addressData.unit_details,
          access_instructions: addressData.access_instructions,
          has_parking: addressData.has_parking || false,
          parking_instructions: addressData.parking_instructions,
          latitude: addressData.latitude,
          longitude: addressData.longitude,
          location: `POINT(${addressData.longitude} ${addressData.latitude})`
        } as any)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const responseData = data as any;
      const lat = responseData.latitude;
      const lng = responseData.longitude;
      const isValid = this.isValidCoordinate(lat, lng);

      const address: UserAddress = {
        id: responseData.id,
        user_id: responseData.user_id,
        label: responseData.label || 'Home',
        is_default: responseData.is_default || false,
        full_address: responseData.full_address,
        unit_details: responseData.unit_details || undefined,
        access_instructions: responseData.access_instructions || undefined,
        has_parking: responseData.has_parking || false,
        parking_instructions: responseData.parking_instructions || undefined,
        location: isValid ? { lat, lng } : { lat: 0, lng: 0 },
        hasValidLocation: isValid,
        created_at: responseData.created_at || '',
        updated_at: responseData.updated_at || ''
      };

      return { data: address, error: null };
    } catch (error) {
      return { data: null, error: 'Failed to create address' };
    }
  }

  /**
   * Update an existing address
   */
  async updateAddress(addressData: UpdateAddressRequest): Promise<{ data: UserAddress | null; error: string | null }> {
    try {
      const { data: { user } } = await this.supabaseService.client.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      // If this is set as default, unset other defaults first
      if (addressData.is_default) {
        await this.unsetDefaultAddresses(user.id, addressData.id);
      }

      const updateData: any = {
        label: addressData.label,
        is_default: addressData.is_default,
        full_address: addressData.full_address,
        unit_details: addressData.unit_details,
        access_instructions: addressData.access_instructions,
        has_parking: addressData.has_parking,
        parking_instructions: addressData.parking_instructions,
      };

      // Only include location if latitude and longitude are provided
      if (addressData.latitude !== undefined && addressData.longitude !== undefined) {
        // Validate coordinates before saving
        if (!this.isValidCoordinate(addressData.latitude, addressData.longitude)) {
          return { data: null, error: 'Invalid location coordinates. Please select a valid location on the map.' };
        }
        updateData.latitude = addressData.latitude;
        updateData.longitude = addressData.longitude;
        updateData.location = `POINT(${addressData.longitude} ${addressData.latitude})`;
      }

      const { data, error } = await this.supabaseService.client
        .from('user_addresses')
        .update(updateData)
        .eq('id', addressData.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const responseData = data as any;
      const lat = responseData.latitude;
      const lng = responseData.longitude;
      const isValid = this.isValidCoordinate(lat, lng);

      const address: UserAddress = {
        id: responseData.id,
        user_id: responseData.user_id,
        label: responseData.label || 'Home',
        is_default: responseData.is_default || false,
        full_address: responseData.full_address,
        unit_details: responseData.unit_details || undefined,
        access_instructions: responseData.access_instructions || undefined,
        has_parking: responseData.has_parking || false,
        parking_instructions: responseData.parking_instructions || undefined,
        location: isValid ? { lat, lng } : { lat: 0, lng: 0 },
        hasValidLocation: isValid,
        created_at: responseData.created_at || '',
        updated_at: responseData.updated_at || ''
      };

      return { data: address, error: null };
    } catch (error) {
      return { data: null, error: 'Failed to update address' };
    }
  }

  /**
   * Delete an address
   */
  async deleteAddress(addressId: string): Promise<{ error: string | null }> {
    try {
      const { data: { user } } = await this.supabaseService.client.auth.getUser();

      if (!user) {
        return { error: 'User not authenticated' };
      }

      const { error } = await this.supabaseService.client
        .from('user_addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', user.id);

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      return { error: 'Failed to delete address' };
    }
  }

  /**
   * Set an address as default
   */
  async setDefaultAddress(addressId: string): Promise<{ error: string | null }> {
    try {
      const { data: { user } } = await this.supabaseService.client.auth.getUser();

      if (!user) {
        return { error: 'User not authenticated' };
      }

      // Start a transaction-like operation
      // First, unset all defaults for this user
      await this.unsetDefaultAddresses(user.id);

      // Then set the new default
      const { error } = await this.supabaseService.client
        .from('user_addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('user_id', user.id);

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      return { error: 'Failed to set default address' };
    }
  }

  /**
   * Get the default address for the current user
   */
  async getDefaultAddress(): Promise<{ data: UserAddress | null; error: string | null }> {
    try {
      const { data: { user } } = await this.supabaseService.client.auth.getUser();

      if (!user) {
        return { data: null, error: 'User not authenticated' };
      }

      const { data, error } = await this.supabaseService.client
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      if (error) {
        // If no default address found, it's not necessarily an error
        if (error.code === 'PGRST116') {
          return { data: null, error: null };
        }
        return { data: null, error: error.message };
      }

      if (!data) {
        return { data: null, error: null };
      }

      const responseData = data as any;
      const lat = responseData.latitude;
      const lng = responseData.longitude;
      const isValid = this.isValidCoordinate(lat, lng);

      const address: UserAddress = {
        id: responseData.id,
        user_id: responseData.user_id,
        label: responseData.label || 'Home',
        is_default: responseData.is_default || false,
        full_address: responseData.full_address,
        unit_details: responseData.unit_details || undefined,
        access_instructions: responseData.access_instructions || undefined,
        has_parking: responseData.has_parking || false,
        parking_instructions: responseData.parking_instructions || undefined,
        location: isValid ? { lat, lng } : { lat: 0, lng: 0 },
        hasValidLocation: isValid,
        created_at: responseData.created_at || '',
        updated_at: responseData.updated_at || ''
      };

      return { data: address, error: null };
    } catch (error) {
      return { data: null, error: 'Failed to fetch default address' };
    }
  }

  /**
   * Helper method to unset all default addresses for a user
   */
  private async unsetDefaultAddresses(userId: string, excludeAddressId?: string): Promise<void> {
    let query = this.supabaseService.client
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId);

    if (excludeAddressId) {
      query = query.neq('id', excludeAddressId);
    }

    await query;
  }

  /**
   * Validate that coordinates are valid and not 0,0
   */
  private isValidCoordinate(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      !(lat === 0 && lng === 0) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180
    );
  }

  /**
   * Parse geography point to lat/lng object (fallback for legacy data)
   * Note: Primary coordinate reading now uses latitude/longitude columns directly
   * Returns null if parsing fails instead of defaulting to 0,0
   */
  private parseGeographyPoint(geographyPoint: any): { lat: number; lng: number } | null {
    if (!geographyPoint) {
      return null;
    }

    // Handle object format as fallback for legacy data
    if (typeof geographyPoint === 'object') {
      const lat = geographyPoint.lat ?? geographyPoint.latitude;
      const lng = geographyPoint.lng ?? geographyPoint.longitude;
      if (this.isValidCoordinate(lat, lng)) {
        return { lat, lng };
      }
    }

    return null;
  }
}