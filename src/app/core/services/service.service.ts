import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';

// Variant properties for structured selection
export interface VariantProperties {
  [key: string]: string | number | boolean;
}

// Option for variant selectors
export interface SelectorOption {
  value: string | number | boolean;
  label: string;
}

// Individual selector in variant selection schema
export interface VariantSelector {
  key: string;
  label: string;
  type: 'select' | 'boolean';
  options: SelectorOption[];
  dependsOn?: { [key: string]: (string | number | boolean)[] };
}

// Schema defining how variants should be selected
export interface VariantSelectionSchema {
  selectors: VariantSelector[];
}

// Grouped service with variants for catalog display
export interface ServiceGroup {
  service: Service;
  variants: ServiceVariant[];
  priceRange: { min: number; max: number };
  priceAfter5Range: { min: number; max: number };
  hasMultipleVariants: boolean;
}

export interface Service {
  id: string;
  category_id: string;
  name: string;
  description: string;
  booking_form_schema: any[];
  image_url?: string;
  variant_selection_schema?: VariantSelectionSchema;
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
  properties?: VariantProperties;
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

export interface ProviderOffering {
  id: string;  // provider_offerings.id
  providerId: string;
  providerName: string;
  avatarUrl?: string;
  rating: number;
  reviewCount: number;
  yearsExperience: number;
  serviceRadius: number;
  status: string;
  isDefault: boolean;  // highest rated = default
}

export interface ServiceWithProviders extends ServiceVariant {
  service: Service;
  providers: ProviderOffering[];  // ALL providers
  selectedProvider: ProviderOffering;  // Default (highest rated)
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
      // Get all active offerings for this service variant, then pick the best one
      const { data: offeringsData, error: offeringError } = await client
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
        .eq('is_active', true);

      if (offeringError) {
        console.error('Error fetching provider offerings:', offeringError);
        return null;
      }

      if (!offeringsData || offeringsData.length === 0) {
        console.error('No provider offerings found for service variant:', serviceVariantId);
        return null;
      }

      // Sort by rating (highest first), then by creation date (oldest first)
      const sortedOfferings = offeringsData.sort((a: any, b: any) => {
        const ratingA = a.provider?.rating_avg || 0;
        const ratingB = b.provider?.rating_avg || 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const offeringData = sortedOfferings[0];

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

  async getServiceWithAllProviders(serviceVariantId: string): Promise<ServiceWithProviders | null> {
    try {
      const client = this.supabaseService.client as any;

      // Get service variant with service and category
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

      // Get ALL provider offerings for this service variant
      const { data: offeringsData, error: offeringError } = await client
        .from('provider_offerings')
        .select(`
          id,
          provider:providers(
            id, bio, years_of_experience, service_radius_km, status,
            rating_avg, rating_count,
            profiles!providers_id_fkey(full_name, avatar_url)
          )
        `)
        .eq('service_variant_id', serviceVariantId)
        .eq('is_active', true);

      if (offeringError) {
        console.error('Error fetching provider offerings:', offeringError);
        return null;
      }

      if (!offeringsData || offeringsData.length === 0) {
        console.error('No provider offerings found for service variant:', serviceVariantId);
        return null;
      }

      // Map to ProviderOffering and sort by rating (highest first)
      const providers: ProviderOffering[] = offeringsData
        .map((o: any) => ({
          id: o.id,
          providerId: o.provider.id,
          providerName: o.provider.profiles?.full_name || 'Provider',
          avatarUrl: o.provider.profiles?.avatar_url,
          rating: o.provider.rating_avg || 0,
          reviewCount: o.provider.rating_count || 0,
          yearsExperience: o.provider.years_of_experience || 0,
          serviceRadius: o.provider.service_radius_km || 10,
          status: o.provider.status,
          isDefault: false
        }))
        .sort((a: ProviderOffering, b: ProviderOffering) => b.rating - a.rating);

      // Mark the first provider (highest rated) as default
      if (providers.length > 0) {
        providers[0].isDefault = true;
      }

      return {
        ...variantData,
        service: variantData.service,
        providers,
        selectedProvider: providers[0],
        category: {
          name: variantData.service.service_categories?.name,
          icon_url: variantData.service.service_categories?.icon_url,
        },
      };
    } catch (error) {
      console.error('Error in getServiceWithAllProviders:', error);
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

  /**
   * Get services grouped by parent service for catalog display
   * Returns ServiceGroup[] with price ranges and variant counts
   */
  async getGroupedServicesByCategory(categorySlug: string): Promise<ServiceGroup[]> {
    try {
      const client = this.supabaseService.client as any;

      // Get services with variant_selection_schema
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

      // For each service, get variants that have active provider offerings
      const serviceGroups: ServiceGroup[] = await Promise.all(
        servicesData.map(async (service: any) => {
          const { data: variantsData, error: variantsError } = await client
            .from('service_variants')
            .select(`
              *,
              provider_offerings!inner(id)
            `)
            .eq('service_id', service.id)
            .eq('is_active', true)
            .eq('provider_offerings.is_active', true);

          if (variantsError) {
            console.error('Error fetching variants for service:', service.id, variantsError);
            return null;
          }

          const variants = variantsData || [];
          if (variants.length === 0) return null;

          // Calculate price ranges
          const prices = variants.map((v: any) => v.price_min);
          const pricesMax = variants.map((v: any) => v.price_max);
          const pricesAfter5 = variants.map((v: any) => v.price_after5_min);
          const pricesAfter5Max = variants.map((v: any) => v.price_after5_max);

          return {
            service: {
              ...service,
              variant_selection_schema: service.variant_selection_schema
            } as Service,
            variants: variants as ServiceVariant[],
            priceRange: {
              min: Math.min(...prices),
              max: Math.max(...pricesMax)
            },
            priceAfter5Range: {
              min: Math.min(...pricesAfter5),
              max: Math.max(...pricesAfter5Max)
            },
            hasMultipleVariants: variants.length > 1
          };
        })
      );

      // Filter out null entries (services with no available variants)
      return serviceGroups.filter((g): g is ServiceGroup => g !== null);
    } catch (error) {
      console.error('Error in getGroupedServicesByCategory:', error);
      return [];
    }
  }

  /**
   * Find a variant by matching properties against selection
   * Used when user makes dropdown selections to find the matching variant
   */
  findVariantByProperties(
    variants: ServiceVariant[],
    selections: VariantProperties
  ): ServiceVariant | null {
    // Filter variants that match all selected properties
    const matchingVariants = variants.filter(variant => {
      if (!variant.properties) {
        // If variant has no properties, it only matches if no selections made
        return Object.keys(selections).length === 0;
      }

      // Check if all selections match the variant's properties
      return Object.entries(selections).every(([key, value]) => {
        const variantValue = variant.properties![key];
        // Handle numeric comparisons (1 vs "1", 1.5 vs "1.5")
        if (typeof value === 'number' || typeof variantValue === 'number') {
          return Number(variantValue) === Number(value);
        }
        return variantValue === value;
      });
    });

    // Return first matching variant, or null if none found
    return matchingVariants.length > 0 ? matchingVariants[0] : null;
  }

  /**
   * Get available options for a selector based on current selections
   * Filters options based on dependsOn rules and available variants
   */
  getAvailableOptions(
    schema: VariantSelectionSchema,
    currentSelections: VariantProperties,
    variants: ServiceVariant[]
  ): VariantSelector[] {
    return schema.selectors
      .filter(selector => {
        // If no dependencies, always show
        if (!selector.dependsOn) return true;

        // Check if all dependencies are satisfied
        return Object.entries(selector.dependsOn).every(([depKey, allowedValues]) => {
          const currentValue = currentSelections[depKey];
          if (currentValue === undefined) return false;
          return allowedValues.some(allowed => {
            if (typeof allowed === 'number' || typeof currentValue === 'number') {
              return Number(allowed) === Number(currentValue);
            }
            return allowed === currentValue;
          });
        });
      })
      .map(selector => {
        // Filter options to only those that have matching variants
        const availableOptions = selector.options.filter(option => {
          const testSelections = { ...currentSelections, [selector.key]: option.value };
          // Check if any variant matches these selections (partial match)
          return variants.some(variant => {
            if (!variant.properties) return false;
            return Object.entries(testSelections).every(([key, value]) => {
              const variantValue = variant.properties![key];
              if (variantValue === undefined) return true; // Property not set in variant, allow
              if (typeof value === 'number' || typeof variantValue === 'number') {
                return Number(variantValue) === Number(value);
              }
              return variantValue === value;
            });
          });
        });

        return {
          ...selector,
          options: availableOptions
        };
      })
      .filter(selector => selector.options.length > 0);
  }
}