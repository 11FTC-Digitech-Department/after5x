import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';

export interface Service {
  id: string;
  category_id: string;
  name: string;
  description: string;
  booking_form_schema: any[];
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceVariant {
  id: string;
  service_id: string;
  name: string;
  description: string;
  price_min: number;
  price_max: number;
  price_after5_min: number;
  price_after5_max: number;
  vat_rate: number;
  transportation_fee: number;
  commission_rate: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Provider {
  id: string;
  bio?: string;
  years_of_experience: number;
  current_location?: any;
  service_radius_km: number;
  status: string;
  rating_avg: number;
  rating_count: number;
  engagement_score: number;
  verification_status: string;
  created_at: string;
  updated_at: string;
  profile?: {
    full_name: string;
    avatar_url?: string;
  };
}

export interface ServiceWithProvider extends ServiceVariant {
  service: Service;
  provider: Provider;
  category: {
    name: string;
    icon_url?: string;
  };
}

export interface ProviderService {
  id: string;
  name: string;
  description?: string;
  price_min: number;
  price_max: number;
  duration_minutes: number;
}

export interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  target_id: string;
  rating: number;
  comment?: string;
  tags?: string[];
  is_public: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class ServiceService {
  private supabaseService = inject(SupabaseService);

  async getServiceWithProvider(serviceVariantId: string): Promise<ServiceWithProvider | null> {
    try {
      // Use a more direct approach to avoid type issues
      const client = this.supabaseService.client as any;

      // First get the service variant with service and category info
      const { data: variantData, error: variantError } = await client
        .from('service_variants')
        .select(`
          *,
          service:services(
            *,
            service_categories(name, icon_url)
          )
        `)
        .eq('id', serviceVariantId)
        .eq('is_active', true)
        .single();

      if (variantError || !variantData) {
        console.error('Error fetching service variant:', variantError);
        return null;
      }

      // Then get the provider offering for this service variant
      const { data: offeringData, error: offeringError } = await client
        .from('provider_offerings')
        .select(`
          *,
          provider:providers(
            id, bio, years_of_experience, service_radius_km, status,
            rating_avg, rating_count, engagement_score, verification_status,
            profiles!providers_id_fkey(full_name, avatar_url)
          )
        `)
        .eq('service_variant_id', serviceVariantId)
        .eq('is_active', true)
        .single();

      if (offeringError || !offeringData) {
        console.error('Error fetching provider offering:', offeringError);
        return null;
      }

      // Combine the data
      return {
        ...variantData,
        service: variantData.service,
        provider: {
          ...offeringData.provider,
          profile: offeringData.provider.profiles,
        },
        category: {
          name: variantData.service.service_categories?.name,
          icon_url: variantData.service.service_categories?.icon_url,
        },
      };
    } catch (error) {
      console.error('Error in getServiceWithProvider:', error);
      return null;
    }
  }

  async getProviderOtherServices(providerId: string, excludeServiceVariantId?: string): Promise<ProviderService[]> {
    try {
      const client = this.supabaseService.client as any;

      let query = client
        .from('provider_offerings')
        .select('service_variant_id')
        .eq('provider_id', providerId)
        .eq('is_active', true);

      if (excludeServiceVariantId) {
        query = query.neq('service_variant_id', excludeServiceVariantId);
      }

      const { data: offeringsData, error: offeringsError } = await query.limit(5);

      if (offeringsError) {
        console.error('Error fetching provider offerings:', offeringsError);
        return [];
      }

      if (!offeringsData || offeringsData.length === 0) {
        return [];
      }

      // Get the service variants
      const variantIds = offeringsData.map((offering: any) => offering.service_variant_id);

      const { data: variantsData, error: variantsError } = await client
        .from('service_variants')
        .select('id, name, description, price_min, price_max, duration_minutes')
        .in('id', variantIds)
        .eq('is_active', true);

      if (variantsError) {
        console.error('Error fetching service variants:', variantsError);
        return [];
      }

      return (variantsData as any[]).map((variant: any) => ({
        id: variant.id,
        name: variant.name,
        description: variant.description,
        price_min: variant.price_min,
        price_max: variant.price_max,
        duration_minutes: variant.duration_minutes,
      }));
    } catch (error) {
      console.error('Error in getProviderOtherServices:', error);
      return [];
    }
  }

  async getServiceCategories() {
    try {
      const { data, error } = await (this.supabaseService.client as any)
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error in getServiceCategories:', error);
      return [];
    }
  }

  /**
   * Get reviews for a specific provider
   */
  async getProviderReviews(providerId: string): Promise<Review[]> {
    try {
      const { data, error } = await (this.supabaseService.client as any)
        .from('reviews')
        .select('*')
        .eq('target_id', providerId)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching provider reviews:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getProviderReviews:', error);
      return [];
    }
  }

  /**
   * Calculate and update provider rating statistics
   */
  async updateProviderRating(providerId: string): Promise<void> {
    try {
      const client = this.supabaseService.client as any;

      // Get all reviews for this provider
      const { data: reviews, error: reviewsError } = await client
        .from('reviews')
        .select('rating')
        .eq('target_id', providerId)
        .eq('is_public', true);

      if (reviewsError) {
        console.error('Error fetching reviews for rating calculation:', reviewsError);
        return;
      }

      if (!reviews || reviews.length === 0) {
        // No reviews, reset to defaults
        await client
          .from('providers')
          .update({
            rating_avg: 0.00,
            rating_count: 0
          })
          .eq('id', providerId);
        return;
      }

      // Calculate average rating
      const totalRating = reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
      const averageRating = Math.round((totalRating / reviews.length) * 100) / 100; // Round to 2 decimal places
      const ratingCount = reviews.length;

      // Update provider with new rating statistics
      const { error: updateError } = await client
        .from('providers')
        .update({
          rating_avg: averageRating,
          rating_count: ratingCount
        })
        .eq('id', providerId);

      if (updateError) {
        console.error('Error updating provider rating:', updateError);
      }
    } catch (error) {
      console.error('Error in updateProviderRating:', error);
    }
  }

  /**
   * Add a new review and update provider rating
   */
  async addReview(reviewData: {
    booking_id: string;
    reviewer_id: string;
    target_id: string;
    rating: number;
    comment?: string;
    tags?: string[];
    is_public?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.supabaseService.client as any;

      const { error } = await client
        .from('reviews')
        .insert({
          booking_id: reviewData.booking_id,
          reviewer_id: reviewData.reviewer_id,
          target_id: reviewData.target_id,
          rating: reviewData.rating,
          comment: reviewData.comment,
          tags: reviewData.tags,
          is_public: reviewData.is_public ?? true
        });

      if (error) {
        console.error('Error adding review:', error);
        return { success: false, error: error.message };
      }

      // Update provider rating after adding review
      await this.updateProviderRating(reviewData.target_id);

      return { success: true };
    } catch (error) {
      console.error('Error in addReview:', error);
      return { success: false, error: 'Failed to add review' };
    }
  }

  async getServicesByCategory(categorySlug: string) {
    try {
      const client = this.supabaseService.client as any;

      // First get services with categories by filtering on category slug
      const { data: servicesData, error: servicesError } = await client
        .from('services')
        .select(`
          *,
          service_categories!inner(name, icon_url, slug)
        `)
        .eq('service_categories.slug', categorySlug)
        .eq('is_active', true);

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        return [];
      }

      // For each service, get its variants with provider offerings
      const servicesWithVariants = await Promise.all(
        servicesData.map(async (service: any) => {
          const { data: variantsData, error: variantsError } = await client
            .from('service_variants')
            .select(`
              *,
              provider_offerings!inner(
                provider:providers(
                  id, bio, years_of_experience, service_radius_km, status,
                  rating_avg, rating_count, engagement_score, verification_status,
                  profiles!providers_id_fkey(full_name, avatar_url)
                )
              )
            `)
            .eq('service_id', service.id)
            .eq('is_active', true)
            .eq('provider_offerings.is_active', true);

          if (variantsError) {
            console.error('Error fetching variants for service:', service.id, variantsError);
            return { ...service, service_variants: [] };
          }

          return { ...service, service_variants: variantsData || [] };
        })
      );

      return servicesWithVariants;
    } catch (error) {
      console.error('Error in getServicesByCategory:', error);
      return [];
    }
  }
}