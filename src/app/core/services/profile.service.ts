import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { SessionService, UserProfile } from '../auth/session';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface ExtendedProfile extends UserProfile {
  phone_number?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProviderProfile {
  id: string;
  bio?: string | null;
  years_of_experience?: number | null;
  verification_status?: string | null;
  status?: string | null;
  service_radius_km?: number | null;
  rating_avg?: number | null;
  rating_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// Helper to check if provider is verified
export function isProviderVerified(profile?: ProviderProfile | null): boolean {
  return profile?.verification_status === 'verified';
}

// Helper to check if provider is active
export function isProviderActive(profile?: ProviderProfile | null): boolean {
  return profile?.status === 'active' || profile?.status === 'online';
}

export interface ProfileUpdateData {
  full_name?: string;
  phone_number?: string;
  avatar_url?: string;
}

export interface ProviderProfileUpdateData {
  bio?: string;
  years_of_experience?: number;
  service_radius_km?: number;
  status?: 'online' | 'offline' | 'busy' | 'suspended' | null;
}

export interface ServiceResult<T> {
  data?: T;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private supabase = inject(SupabaseService).client;
  private sessionService = inject(SessionService);

  private readonly AVATAR_BUCKET = 'avatars';
  private readonly MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  /**
   * Get extended profile data for the current user
   */
  async getExtendedProfile(userId?: string): Promise<ServiceResult<ExtendedProfile>> {
    const profileId = userId || this.sessionService.profile()?.id;

    if (!profileId) {
      return { error: 'User not authenticated' };
    }

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) {
        console.error('Error fetching extended profile:', error);
        return { error: error.message };
      }

      return { data: data as ExtendedProfile };
    } catch (err: any) {
      console.error('Unexpected error fetching profile:', err);
      return { error: err.message || 'Failed to fetch profile' };
    }
  }

  /**
   * Get provider-specific profile data
   */
  async getProviderProfile(providerId?: string): Promise<ServiceResult<ProviderProfile>> {
    const id = providerId || this.sessionService.profile()?.id;

    if (!id) {
      return { error: 'User not authenticated' };
    }

    try {
      const { data, error } = await this.supabase
        .from('providers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching provider profile:', error);
        return { error: error.message };
      }

      return { data: data as ProviderProfile };
    } catch (err: any) {
      console.error('Unexpected error fetching provider profile:', err);
      return { error: err.message || 'Failed to fetch provider profile' };
    }
  }

  /**
   * Get provider's average rating and review count
   */
  async getProviderRating(providerId?: string): Promise<ServiceResult<{ rating: number; totalReviews: number }>> {
    const id = providerId || this.sessionService.profile()?.id;

    if (!id) {
      return { error: 'User not authenticated' };
    }

    try {
      const { data, error } = await this.supabase
        .from('reviews')
        .select('rating')
        .eq('provider_id', id);

      if (error) {
        console.error('Error fetching provider reviews:', error);
        return { error: error.message };
      }

      const reviews = data || [];
      const totalReviews = reviews.length;
      const rating = totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

      return { data: { rating: Math.round(rating * 10) / 10, totalReviews } };
    } catch (err: any) {
      console.error('Unexpected error fetching provider rating:', err);
      return { error: err.message || 'Failed to fetch provider rating' };
    }
  }

  /**
   * Update basic profile information
   */
  async updateProfile(updates: ProfileUpdateData): Promise<ServiceResult<ExtendedProfile>> {
    const userId = this.sessionService.profile()?.id;

    if (!userId) {
      return { error: 'User not authenticated' };
    }

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        return { error: error.message };
      }

      return { data: data as ExtendedProfile };
    } catch (err: any) {
      console.error('Unexpected error updating profile:', err);
      return { error: err.message || 'Failed to update profile' };
    }
  }

  /**
   * Update provider-specific profile information
   */
  async updateProviderProfile(updates: ProviderProfileUpdateData): Promise<ServiceResult<ProviderProfile>> {
    const userId = this.sessionService.profile()?.id;

    if (!userId) {
      return { error: 'User not authenticated' };
    }

    try {
      const { data, error } = await this.supabase
        .from('providers')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating provider profile:', error);
        return { error: error.message };
      }

      return { data: data as ProviderProfile };
    } catch (err: any) {
      console.error('Unexpected error updating provider profile:', err);
      return { error: err.message || 'Failed to update provider profile' };
    }
  }

  /**
   * Pick and upload avatar image from camera or gallery
   */
  async pickAndUploadAvatar(source: CameraSource = CameraSource.Photos): Promise<ServiceResult<string>> {
    const userId = this.sessionService.profile()?.id;

    if (!userId) {
      return { error: 'User not authenticated' };
    }

    try {
      // Take photo or pick from gallery
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: source,
        width: 500,
        height: 500
      });

      if (!photo.base64String) {
        return { error: 'No image data captured' };
      }

      // Convert base64 to Blob
      const byteCharacters = atob(photo.base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${photo.format || 'jpeg'}` });

      // Validate file size
      if (blob.size > this.MAX_AVATAR_SIZE) {
        return { error: `Image size exceeds ${this.MAX_AVATAR_SIZE / (1024 * 1024)}MB limit` };
      }

      // Upload to storage
      const fileName = `${userId}/avatar_${Date.now()}.${photo.format || 'jpeg'}`;

      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.AVATAR_BUCKET)
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading avatar:', uploadError);
        return { error: uploadError.message };
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.AVATAR_BUCKET)
        .getPublicUrl(uploadData.path);

      const avatarUrl = urlData.publicUrl;

      // Update profile with new avatar URL
      const updateResult = await this.updateProfile({ avatar_url: avatarUrl });

      if (updateResult.error) {
        return { error: updateResult.error };
      }

      return { data: avatarUrl };
    } catch (err: any) {
      console.error('Error in pickAndUploadAvatar:', err);
      if (err.message?.includes('User cancelled')) {
        return { error: 'cancelled' };
      }
      return { error: err.message || 'Failed to upload avatar' };
    }
  }

  /**
   * Delete avatar from storage and clear from profile
   */
  async deleteAvatar(): Promise<ServiceResult<void>> {
    const userId = this.sessionService.profile()?.id;

    if (!userId) {
      return { error: 'User not authenticated' };
    }

    try {
      // List files in user's avatar folder
      const { data: files, error: listError } = await this.supabase.storage
        .from(this.AVATAR_BUCKET)
        .list(userId);

      if (listError) {
        console.error('Error listing avatar files:', listError);
      }

      // Delete all avatar files for this user
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${userId}/${f.name}`);
        await this.supabase.storage
          .from(this.AVATAR_BUCKET)
          .remove(filePaths);
      }

      // Clear avatar_url in profile
      await this.updateProfile({ avatar_url: '' });

      return {};
    } catch (err: any) {
      console.error('Error deleting avatar:', err);
      return { error: err.message || 'Failed to delete avatar' };
    }
  }

  /**
   * Format member since date
   */
  formatMemberSince(dateString?: string): string {
    if (!dateString) return 'Member';

    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      year: 'numeric'
    };
    return `Member since ${date.toLocaleDateString('en-US', options)}`;
  }

  /**
   * Get initials from full name for avatar fallback
   */
  getInitials(fullName?: string): string {
    if (!fullName) return '?';

    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  }
}
