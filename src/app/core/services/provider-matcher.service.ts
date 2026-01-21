import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { ProviderInfo, ProviderMatchCriteria, ProviderWithScore, ProviderAssignmentError } from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class ProviderMatcherService {
  private supabaseService = inject(SupabaseService);

  async findBestProvider(criteria: ProviderMatchCriteria): Promise<ProviderInfo | null> {
    try {
      // Get available providers using the database function
      const { data: providers, error } = await this.supabaseService.client
        .rpc('get_available_providers', {
          p_lat: criteria.location.lat,
          p_lng: criteria.location.lng,
          p_service_type: criteria.serviceType,
          p_max_distance: criteria.maxDistance || 50000
        });

      if (error || !providers || providers.length === 0) {
        throw new ProviderAssignmentError('No providers available for this service', 'no_providers');
      }

      // Convert to ProviderWithScore format
      const providersWithScores: ProviderWithScore[] = providers.map(p => ({
        id: p.provider_id,
        profile: {
          full_name: p.provider_name,
          avatar_url: undefined, // Will be fetched separately if needed
          phone_number: undefined
        },
        rating: p.provider_rating,
        totalBookings: 0, // Not available in the function
        location: { lat: 0, lng: 0 }, // Not available in the function
        distance: p.distance_meters,
        estimatedArrival: p.estimated_arrival_minutes,
        services: [criteria.serviceType],
        isOnline: p.is_online,
        currentStatus: p.is_online ? 'available' : 'offline',
        matchScore: 0, // Will be calculated
        distanceScore: 0,
        ratingScore: 0,
        availabilityScore: 0,
        urgencyScore: 0
      }));

      // Calculate scores for ranking
      providersWithScores.forEach(provider => {
        this.calculateProviderScore(provider, criteria);
      });

      // Sort by total score (higher is better)
      providersWithScores.sort((a, b) => b.matchScore - a.matchScore);

      const bestProvider = providersWithScores[0];

      if (!bestProvider) {
        throw new ProviderAssignmentError('No suitable providers found', 'no_providers');
      }

      // Convert to ProviderInfo format
      return this.formatProviderInfo(bestProvider);

    } catch (error) {
      if (error instanceof ProviderAssignmentError) {
        throw error;
      }
      console.error('Provider matching failed:', error);
      return null;
    }
  }

  private calculateProviderScore(provider: ProviderWithScore, criteria: ProviderMatchCriteria): void {
    // Distance score (closer is better, max score 100)
    const distanceScore = Math.max(0, 100 - (provider.distance! / 1000)); // Deduct 1 point per km

    // Rating score (higher rating is better, max score 20)
    const ratingScore = (provider.rating || 0) * 4; // 0-5 rating * 4 = 0-20 points

    // Availability score (online providers get bonus, max score 20)
    const availabilityScore = provider.isOnline ? 20 : 10;

    // Urgency score based on response time capability
    const urgencyScore = this.calculateUrgencyScore(criteria.urgency, provider.estimatedArrival || 0);

    // Total match score
    provider.matchScore = distanceScore + ratingScore + availabilityScore + urgencyScore;
    provider.distanceScore = distanceScore;
    provider.ratingScore = ratingScore;
    provider.availabilityScore = availabilityScore;
    provider.urgencyScore = urgencyScore;
  }

  private calculateDistance(point1: { lat: number; lng: number }, point2: any): number {
    // Haversine formula for distance calculation
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.coordinates[1] * Math.PI / 180; // Supabase PostGIS stores as [lng, lat]
    const Δφ = (point2.coordinates[1] - point1.lat) * Math.PI / 180;
    const Δλ = (point2.coordinates[0] - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  private calculateEstimatedArrival(distance: number, providerStatus: string): number {
    // Base speed assumptions (km/h)
    const baseSpeed = providerStatus === 'available' ? 30 : 25; // km/h
    const distanceKm = distance / 1000;

    // Time in minutes (distance / speed + buffer time)
    const travelTime = (distanceKm / baseSpeed) * 60;
    const bufferTime = Math.min(15, travelTime * 0.2); // 20% buffer, max 15 min

    return Math.round(travelTime + bufferTime);
  }

  private calculateUrgencyScore(urgency: string, estimatedArrival: number): number {
    const urgencyWeights = {
      emergency: { maxTime: 30, weight: 30 },  // Must arrive within 30 min
      high: { maxTime: 60, weight: 25 },       // Must arrive within 1 hour
      medium: { maxTime: 120, weight: 20 },    // Must arrive within 2 hours
      low: { maxTime: 240, weight: 15 }        // Can arrive within 4 hours
    };

    const config = urgencyWeights[urgency as keyof typeof urgencyWeights];
    if (!config) return 0;

    if (estimatedArrival <= config.maxTime) {
      return config.weight;
    } else if (estimatedArrival <= config.maxTime * 1.5) {
      return config.weight * 0.5; // Half points if slightly over
    }

    return 0; // No points if too far
  }

  private formatProviderInfo(provider: ProviderWithScore): ProviderInfo {
    return {
      id: provider.id,
      profile: provider.profile,
      rating: provider.rating,
      totalBookings: provider.totalBookings,
      location: provider.location,
      distance: provider.distance,
      estimatedArrival: provider.estimatedArrival,
      services: provider.services,
      isOnline: provider.isOnline,
      currentStatus: provider.currentStatus
    };
  }

  async getProviderDetails(providerId: string): Promise<ProviderInfo | null> {
    try {
      const client = this.supabaseService.client;

      // Get provider data
      const { data: provider, error: providerError } = await client
        .from('providers')
        .select('id, status, rating_avg, rating_count')
        .eq('id', providerId)
        .single();

      if (providerError || !provider) {
        console.error('Failed to get provider:', providerError);
        return null;
      }

      // Get profile data separately
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('full_name, avatar_url, phone_number')
        .eq('id', providerId)
        .single();

      if (profileError) {
        console.error('Failed to get provider profile:', profileError);
      }

      return {
        id: provider.id,
        profile: {
          full_name: profile?.full_name || 'Unknown Provider',
          avatar_url: profile?.avatar_url || undefined,
          phone_number: profile?.phone_number || undefined
        },
        rating: provider.rating_avg || 0,
        totalBookings: provider.rating_count || 0,
        location: { lat: 0, lng: 0 }, // Would need additional query for location
        services: [], // Would need additional query
        isOnline: provider.status === 'online',
        currentStatus: (provider.status || 'offline') as any
      };
    } catch (error) {
      console.error('Error in getProviderDetails:', error);
      return null;
    }
  }
}