import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { UserAddress, CreateAddressRequest, UpdateAddressRequest } from '../models/address.model';
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

      // Transform the location from PostGIS geography to lat/lng
      const addresses: UserAddress[] = data?.map(address => ({
        id: address.id,
        user_id: address.user_id,
        label: address.label || 'Home',
        is_default: address.is_default || false,
        full_address: address.full_address,
        unit_details: address.unit_details || undefined,
        access_instructions: address.access_instructions || undefined,
        has_parking: address.has_parking || false,
        parking_instructions: address.parking_instructions || undefined,
        location: this.parseGeographyPoint(address.location),
        created_at: address.created_at || '',
        updated_at: address.updated_at || ''
      })) || [];

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

      const address: UserAddress = {
        id: data.id,
        user_id: data.user_id,
        label: data.label || 'Home',
        is_default: data.is_default || false,
        full_address: data.full_address,
        unit_details: data.unit_details || undefined,
        access_instructions: data.access_instructions || undefined,
        has_parking: data.has_parking || false,
        parking_instructions: data.parking_instructions || undefined,
        location: this.parseGeographyPoint(data.location),
        created_at: data.created_at || '',
        updated_at: data.updated_at || ''
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
          location: `POINT(${addressData.longitude} ${addressData.latitude})`
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const address: UserAddress = {
        id: data.id,
        user_id: data.user_id,
        label: data.label || 'Home',
        is_default: data.is_default || false,
        full_address: data.full_address,
        unit_details: data.unit_details || undefined,
        access_instructions: data.access_instructions || undefined,
        has_parking: data.has_parking || false,
        parking_instructions: data.parking_instructions || undefined,
        location: this.parseGeographyPoint(data.location),
        created_at: data.created_at || '',
        updated_at: data.updated_at || ''
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

      const address: UserAddress = {
        id: data.id,
        user_id: data.user_id,
        label: data.label || 'Home',
        is_default: data.is_default || false,
        full_address: data.full_address,
        unit_details: data.unit_details || undefined,
        access_instructions: data.access_instructions || undefined,
        has_parking: data.has_parking || false,
        parking_instructions: data.parking_instructions || undefined,
        location: this.parseGeographyPoint(data.location),
        created_at: data.created_at || '',
        updated_at: data.updated_at || ''
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

      const address: UserAddress = {
        id: data.id,
        user_id: data.user_id,
        label: data.label || 'Home',
        is_default: data.is_default || false,
        full_address: data.full_address,
        unit_details: data.unit_details || undefined,
        access_instructions: data.access_instructions || undefined,
        has_parking: data.has_parking || false,
        parking_instructions: data.parking_instructions || undefined,
        location: this.parseGeographyPoint(data.location),
        created_at: data.created_at || '',
        updated_at: data.updated_at || ''
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
   * Parse PostGIS geography point to lat/lng object
   */
  private parseGeographyPoint(geographyPoint: any): { lat: number; lng: number } {
    // PostGIS geography point comes as "POINT(lng lat)" string or already parsed object
    if (typeof geographyPoint === 'string') {
      const match = geographyPoint.match(/POINT\(([^ ]+) ([^)]+)\)/);
      if (match) {
        return {
          lng: parseFloat(match[1]),
          lat: parseFloat(match[2])
        };
      }
    }

    // If it's already an object with coordinates
    if (geographyPoint && typeof geographyPoint === 'object') {
      return {
        lat: geographyPoint.lat || geographyPoint.latitude || 0,
        lng: geographyPoint.lng || geographyPoint.longitude || 0
      };
    }

    return { lat: 0, lng: 0 };
  }
}