import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { SessionService } from '../auth/session';
import { MediaService } from './media.service';
import { ProviderMatcherService } from './provider-matcher.service';
import { NotificationService } from './notification.service';
import { BookingStatusService } from './booking-status.service';
import {
  BookingSubmissionData,
  BookingResponse,
  BookingStatus,
  BookingSchedulingType,
  ProviderInfo,
  BookingError,
  PriceBreakdown,
  CustomerBooking
} from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private mediaService = inject(MediaService);
  private providerMatcher = inject(ProviderMatcherService);
  private notificationService = inject(NotificationService);
  private statusService = inject(BookingStatusService);

  /**
   * Fetch all bookings for a specific customer
   */
  async getCustomerBookings(customerId: string): Promise<CustomerBooking[]> {
    const client = this.supabaseService.client;

    const { data, error } = await client
      .from('bookings')
      .select(`
        *,
        booking_items (
          *,
          service_variants (
            id,
            name,
            services (
              id,
              name,
              service_categories (icon_url)
            )
          )
        ),
        providers (
          id,
          profiles (full_name, avatar_url)
        ),
        booking_timeline (*)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BookingError(`Failed to fetch bookings: ${error.message}`, 'FETCH_FAILED');
    }

    return (data || []) as unknown as CustomerBooking[];
  }

  /**
   * Fetch a single booking by ID with all related data
   */
  async getBookingById(bookingId: string): Promise<CustomerBooking | null> {
    const client = this.supabaseService.client;

    const { data, error } = await client
      .from('bookings')
      .select(`
        *,
        booking_items (
          *,
          service_variants (
            id,
            name,
            services (
              id,
              name,
              service_categories (icon_url)
            )
          )
        ),
        providers (
          id,
          profiles (full_name, avatar_url, phone_number)
        ),
        booking_timeline (*),
        booking_media (*)
      `)
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Failed to fetch booking:', error);
      return null;
    }

    return data as unknown as CustomerBooking;
  }

  async createBooking(data: BookingSubmissionData): Promise<BookingResponse> {
    const client = this.supabaseService.client;
    const userProfile = this.sessionService.profile();

    if (!userProfile) {
      throw new BookingError('User not authenticated', 'AUTH_REQUIRED', 401);
    }

    // Ensure customer record exists
    await this.ensureCustomerRecord(userProfile.id);

    // Start transaction-like operation
    let bookingId: string | null = null;
    let uploadedMedia: any[] = [];

    try {
      // Step 1: Create booking record
      const bookingData = {
        customer_id: userProfile.id,
        booking_type: this.mapUrgencyToSchedulingType(data.urgency),
        scheduled_for: data.preferredDateTime,
        address_snapshot: {
          address: data.location.address,
          contact_person: data.contactInfo.person,
          contact_phone: data.contactInfo.phone,
          special_instructions: data.specialInstructions,
          // Store additional booking details
          service_type: data.serviceType,
          urgency: data.urgency,
          preferred_date: data.preferredDate,
          preferred_timeslot: data.preferredTimeslot,
          description: data.description
        },
        service_location: `POINT(${data.location.lng} ${data.location.lat})`,
        status: BookingStatus.FINDING_PROVIDER,
        total_labor_base: this.calculateBasePrice(data),
        created_at: new Date().toISOString()
      };

      const { data: booking, error: bookingError } = await client
        .from('bookings')
        .insert(bookingData)
        .select('id')
        .single();

      if (bookingError) {
        throw new BookingError(`Failed to create booking: ${bookingError.message}`, 'BOOKING_CREATION_FAILED');
      }

      bookingId = booking.id;

      // Step 2: Upload media files if any
      if (data.mediaFiles.length > 0) {
        try {
          uploadedMedia = await this.mediaService.uploadBookingMedia(bookingId, data.mediaFiles, 'PROBLEM_REPORT');
        } catch (mediaError) {
          console.error('Media upload failed:', mediaError);
          // Continue with booking creation even if media upload fails
        }
      }

      // Step 3: Create booking item if service variant is specified
      if (data.serviceVariantId) {
        await this.createBookingItem(bookingId, data.serviceVariantId, data.urgency, data.preferredDateTime);
      }

      // Step 4: Find and assign provider - prefer pre-selected, otherwise search
      let assignedProvider: ProviderInfo | null = null;

      if (data.preSelectedProviderId) {
        // Use pre-selected provider from service variant (user selected on service details page)
        assignedProvider = await this.providerMatcher.getProviderDetails(data.preSelectedProviderId);
      }

      if (!assignedProvider) {
        // No pre-selected provider or failed to get details, search for best match
        assignedProvider = await this.assignProvider(bookingId, {
          serviceType: data.serviceType,
          location: data.location,
          urgency: data.urgency
        });
      }

      // Step 5: Update booking with provider assignment
      if (assignedProvider) {
        await client
          .from('bookings')
          .update({
            provider_id: assignedProvider.id,
            provider_assigned_at: new Date().toISOString(),
            status: BookingStatus.PENDING_ACCEPTANCE
          })
          .eq('id', bookingId);

        // Step 6: Notify provider
        await this.notificationService.notifyProviderAssignment(bookingId, assignedProvider.id, data);
      }

      // Step 7: Create timeline entry
      await this.statusService.createTimelineEntry(bookingId, BookingStatus.FINDING_PROVIDER, {
        title: 'Booking Created',
        description: 'Your service request has been submitted and is being processed.'
      });

      // Step 8: Calculate final pricing and update booking
      const priceBreakdown = await this.calculateFinalPrice(bookingId);

      // Update booking with calculated grand total
      await client
        .from('bookings')
        .update({
          grand_total: priceBreakdown.total,
          platform_fee: (priceBreakdown.total * 0.10), // 10% platform fee
          provider_earnings: priceBreakdown.total - (priceBreakdown.total * 0.10)
        })
        .eq('id', bookingId);

      return {
        bookingId,
        status: assignedProvider ? BookingStatus.PENDING_ACCEPTANCE : BookingStatus.FINDING_PROVIDER,
        assignedProvider: assignedProvider || undefined,
        estimatedArrival: assignedProvider?.estimatedArrival ? new Date(Date.now() + assignedProvider.estimatedArrival * 60000) : undefined,
        trackingUrl: `/c/bookings/${bookingId}`
      };

    } catch (error) {
      // Rollback: Delete booking and uploaded media if creation failed
      if (bookingId) {
        await this.rollbackBooking(bookingId, uploadedMedia);
      }
      throw error;
    }
  }

  private async assignProvider(bookingId: string, criteria: { serviceType: string; location: any; urgency: string }): Promise<ProviderInfo | null> {
    try {
      const provider = await this.providerMatcher.findBestProvider({
        serviceType: criteria.serviceType,
        location: criteria.location,
        urgency: criteria.urgency as any
      });

      if (provider) {
        // Update provider status to busy using SECURITY DEFINER function
        await this.updateProviderStatus(provider.id, 'busy', bookingId);
      }

      return provider;
    } catch (error) {
      console.error('Provider assignment failed:', error);
      return null;
    }
  }

  private async createBookingItem(bookingId: string, serviceVariantId: string, urgency: string, preferredDateTime: string): Promise<void> {
    const client = this.supabaseService.client;

    try {
      // Get service variant details with all pricing fields
      const { data: variant, error: variantError } = await client
        .from('service_variants')
        .select('name, price_min, price_after5_min, transportation_fee, vat_rate')
        .eq('id', serviceVariantId)
        .single();

      if (variantError || !variant) {
        console.error('Failed to get service variant:', variantError);
        return;
      }

      // Determine price tier based on PREFERRED BOOKING TIME (not current time)
      const priceTier = this.determinePriceTier(preferredDateTime);

      // Select appropriate base price based on tier
      const basePrice = priceTier === 'AFTER5_NIGHT'
        ? (variant.price_after5_min || variant.price_min)
        : variant.price_min;

      // Use SECURITY DEFINER function to bypass RLS
      const { error: itemError } = await client.rpc('create_booking_item', {
        p_booking_id: bookingId,
        p_service_variant_id: serviceVariantId,
        p_variant_name: variant.name,
        p_price_tier: priceTier,
        p_base_price: basePrice,
        p_transportation_fee: variant.transportation_fee || 0, // Use actual fee from variant
        p_vat_rate: variant.vat_rate || 0.12
      });

      if (itemError) {
        console.error('Failed to create booking item:', itemError);
      }
    } catch (error) {
      console.error('Error in createBookingItem:', error);
    }
  }

  private async updateProviderStatus(
    providerId: string,
    status: 'online' | 'busy' | 'offline' | 'suspended',
    bookingId?: string
  ): Promise<void> {
    const client = this.supabaseService.client as any;

    // Use SECURITY DEFINER function to bypass RLS when updating provider status
    const { error } = await client.rpc('update_provider_status_for_booking', {
      p_provider_id: providerId,
      p_new_status: status,
      p_booking_id: bookingId || null
    });

    if (error) {
      console.error('Failed to update provider status:', error);
      // Don't throw - status update failure shouldn't break the booking flow
    }
  }

  private async calculateFinalPrice(bookingId: string): Promise<PriceBreakdown> {
    const client = this.supabaseService.client;

    // Get booking with items
    const { data: booking, error } = await client
      .from('bookings')
      .select(`
        *,
        booking_items (*)
      `)
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new BookingError('Failed to calculate pricing', 'PRICING_CALCULATION_FAILED');
    }

    const baseService = booking.total_labor_base || 0;
    const transportationFee = booking.total_transport_fees || 0;
    const materialsAmount = booking.total_materials_amount || 0;
    const vatRate = 0.12;
    const subtotal = baseService + transportationFee + materialsAmount;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;

    return {
      baseService,
      urgencyFee: 0, // Already included in base service
      transportationFee,
      mediaProcessingFee: 0, // Handled separately
      vatAmount,
      total,
      tier: 'STANDARD_DAY' // Default tier
    };
  }

  private calculateBasePrice(data: BookingSubmissionData): number {
    // Base pricing logic - can be enhanced with more complex rules
    const baseRates: Record<string, number> = {
      locksmithing: 800,
      aircon: 1200,
      electrical: 1000,
      automotive: 1500,
      plumbing: 900,
      other: 1000
    };

    const urgencyMultipliers: Record<string, number> = {
      low: 1.0,
      medium: 1.2,
      high: 1.4,
      emergency: 2.0
    };

    const baseRate = baseRates[data.serviceType] || baseRates['other'];
    const urgencyMultiplier = urgencyMultipliers[data.urgency] || 1.0;

    return Math.round(baseRate * urgencyMultiplier);
  }

  private mapUrgencyToSchedulingType(urgency: string): BookingSchedulingType {
    return urgency === 'emergency' ? 'ASAP' : 'SCHEDULED';
  }

  private determinePriceTier(preferredDateTime: string): 'STANDARD_DAY' | 'AFTER5_NIGHT' {
    // Parse the preferred booking time (ISO string format: "2026-01-15T17:00:00")
    const bookingDate = new Date(preferredDateTime);
    const hour = bookingDate.getHours();

    // After 5 = 5 PM (17:00) to 6 AM (06:00)
    const isAfter5 = hour >= 17 || hour < 6;

    return isAfter5 ? 'AFTER5_NIGHT' : 'STANDARD_DAY';
  }

  private async ensureCustomerRecord(userId: string): Promise<void> {
    const client = this.supabaseService.client as any;

    try {
      // Use SECURITY DEFINER function for atomic upsert - handles race conditions safely
      const { error } = await client.rpc('ensure_customer_record', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error ensuring customer record:', error);
        throw new BookingError('Failed to create customer record', 'CUSTOMER_CREATION_FAILED');
      }
    } catch (error) {
      console.error('Error in ensureCustomerRecord:', error);
      throw error;
    }
  }

  private async rollbackBooking(bookingId: string, uploadedMedia: any[]): Promise<void> {
    const client = this.supabaseService.client;

    try {
      // Delete uploaded media files
      if (uploadedMedia.length > 0) {
        const filePaths = uploadedMedia.map(media => media.url);
        await client.storage.from('booking-attachments').remove(filePaths);
      }

      // Delete booking (cascade will delete related records)
      await client
        .from('bookings')
        .delete()
        .eq('id', bookingId);

    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
  }
}