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
    let variantPricing: { name: string; vat_rate: number; basePrice: number; transportationFee: number; priceTier: 'STANDARD_DAY' | 'AFTER5_NIGHT'; commission_rate: number; commission_amount: number } | null = null;
    let commissionAmount: number = 0;
    let baseServiceFee: number = 0;
    let urgentFee: number = 0;
    let bodyCameraFee: number = 0;

    try {
      if (data.serviceVariantId) {
        const { data: v, error: vErr } = await client
          .from('service_variants')
          .select('name, price_min, price_after5_min, transportation_fee, transportation_fee_after5, urgent_charge, body_camera_fee, vat_rate, commission_rate, commission_amount_min_8to5, commission_amount_min_5to8')
          .eq('id', data.serviceVariantId)
          .single();
        if (!vErr && v) {
          const tier = this.determinePriceTier(data.preferredDateTime);
          const calculatedBaseFee = tier === 'AFTER5_NIGHT' ? (v.price_after5_min ?? v.price_min) : v.price_min;
          const calculatedUrgentFee = data.urgency === 'emergency' ? (v.urgent_charge ?? 0) : 0;
          const transport: number = tier === 'AFTER5_NIGHT' ? (v.transportation_fee_after5 ?? v.transportation_fee ?? 0) : (v.transportation_fee ?? 0);
          const calculatedBodyCameraFee = data.bodyCameraRequested === true ? (v.body_camera_fee ?? 0) : 0;
          
          // Commission: use tier-specific amount or calculate from rate
          const calculatedCommissionAmount = tier === 'AFTER5_NIGHT'
            ? (v.commission_amount_min_5to8 ?? (v.commission_rate ? (calculatedBaseFee * v.commission_rate / 100) : 0))
            : (v.commission_amount_min_8to5 ?? (v.commission_rate ? (calculatedBaseFee * v.commission_rate / 100) : 0));
          
          baseServiceFee = calculatedBaseFee;
          urgentFee = calculatedUrgentFee;
          bodyCameraFee = calculatedBodyCameraFee;
          
          variantPricing = {
            name: v.name,
            vat_rate: v.vat_rate ?? 0.12,
            basePrice: calculatedBaseFee + calculatedUrgentFee,
            transportationFee: transport,
            priceTier: tier,
            commission_rate: v.commission_rate || 0,
            commission_amount: calculatedCommissionAmount
          };
          commissionAmount = calculatedCommissionAmount;
        }
      }

      const totalLaborBase: number = variantPricing ? variantPricing.basePrice + bodyCameraFee : this.calculateBasePrice(data);

      // Step 1: Create booking record with cost breakdown
      const bookingData: any = {
        customer_id: userProfile.id,
        booking_type: this.mapUrgencyToSchedulingType(data.urgency),
        scheduled_for: data.preferredDateTime,
        address_snapshot: {
          address: data.location.address,
          contact_person: data.contactInfo.person,
          contact_phone: data.contactInfo.phone,
          special_instructions: data.specialInstructions,
          service_type: data.serviceType,
          urgency: data.urgency,
          preferred_date: data.preferredDate,
          preferred_timeslot: data.preferredTimeslot,
          description: data.description
        },
        service_location: `POINT(${data.location.lng} ${data.location.lat})`,
        status: BookingStatus.FINDING_PROVIDER,
        total_labor_base: totalLaborBase,
        base_service_fee: variantPricing ? baseServiceFee : (totalLaborBase),
        urgent_fee: variantPricing ? urgentFee : 0,
        body_camera_fee: variantPricing ? bodyCameraFee : 0,
        commission_rate: variantPricing ? variantPricing.commission_rate : 0,
        commission_amount: variantPricing ? commissionAmount : 0,
        created_at: new Date().toISOString()
      };

      const { data: booking, error: bookingError } = await client
        .from('bookings')
        .insert(bookingData)
        .select('id')
        .single() as { data: { id: string } | null; error: any };

      if (bookingError || !booking) {
        throw new BookingError(`Failed to create booking: ${bookingError?.message || 'Unknown error'}`, 'BOOKING_CREATION_FAILED');
      }

      bookingId = booking.id;

      // Step 2: Upload media files if any
      if (data.mediaFiles.length > 0) {
        try {
          uploadedMedia = await this.mediaService.uploadBookingMedia(bookingId, data.mediaFiles, 'PROBLEM_REPORT');
        } catch (mediaError) {
          console.error('Media upload failed:', mediaError);
        }
      }

      // Step 3: Create booking item and set transport total when variant is specified
      if (data.serviceVariantId && variantPricing) {
        await this.createBookingItemWithPricing(bookingId, data.serviceVariantId, variantPricing);
        await client
          .from('bookings')
          .update({ total_transport_fees: variantPricing.transportationFee })
          .eq('id', bookingId);
      } else if (data.serviceVariantId) {
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

      // Step 8: Calculate final pricing and update booking with commission
      const priceBreakdown = await this.calculateFinalPrice(bookingId);

      // Get commission amount from booking (already calculated and stored at creation based on time tier)
      const { data: bookingForCommission } = await client
        .from('bookings')
        .select('commission_amount')
        .eq('id', bookingId)
        .single() as { data: { commission_amount: number | null } | null; error: any };

      // Use stored commission amount (calculated based on time tier)
      const finalCommissionAmount: number = bookingForCommission?.commission_amount || 0;

      // Update booking with calculated grand total and commission
      await client
        .from('bookings')
        .update({
          grand_total: priceBreakdown.total,
          platform_fee: finalCommissionAmount,
          commission_amount: finalCommissionAmount,
          provider_earnings: priceBreakdown.total - finalCommissionAmount
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

  private async createBookingItemWithPricing(
    bookingId: string,
    serviceVariantId: string,
    pricing: { name: string; vat_rate: number; basePrice: number; transportationFee: number; priceTier: 'STANDARD_DAY' | 'AFTER5_NIGHT' }
  ): Promise<void> {
    const client = this.supabaseService.client;
    try {
      const { error: itemError } = await client.rpc('create_booking_item', {
        p_booking_id: bookingId,
        p_service_variant_id: serviceVariantId,
        p_variant_name: pricing.name,
        p_price_tier: pricing.priceTier,
        p_base_price: pricing.basePrice,
        p_transportation_fee: pricing.transportationFee,
        p_vat_rate: pricing.vat_rate
      });
      if (itemError) console.error('Failed to create booking item:', itemError);
    } catch (error) {
      console.error('Error in createBookingItemWithPricing:', error);
    }
  }

  private async createBookingItem(bookingId: string, serviceVariantId: string, urgency: string, preferredDateTime: string): Promise<void> {
    const client = this.supabaseService.client;

    try {
      const { data: variant, error: variantError } = await client
        .from('service_variants')
        .select('name, price_min, price_after5_min, transportation_fee, transportation_fee_after5, vat_rate')
        .eq('id', serviceVariantId)
        .single();

      if (variantError || !variant) {
        console.error('Failed to get service variant:', variantError);
        return;
      }

      const priceTier = this.determinePriceTier(preferredDateTime);
      const basePrice = priceTier === 'AFTER5_NIGHT'
        ? (variant.price_after5_min ?? variant.price_min)
        : variant.price_min;
      const transport: number = priceTier === 'AFTER5_NIGHT'
        ? (variant.transportation_fee_after5 ?? variant.transportation_fee ?? 0)
        : (variant.transportation_fee ?? 0);

      const { error: itemError } = await client.rpc('create_booking_item', {
        p_booking_id: bookingId,
        p_service_variant_id: serviceVariantId,
        p_variant_name: variant.name,
        p_price_tier: priceTier,
        p_base_price: basePrice,
        p_transportation_fee: transport,
        p_vat_rate: variant.vat_rate ?? 0.12
      });

      if (itemError) console.error('Failed to create booking item:', itemError);
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

    // Use individual breakdown fields for accurate calculation (matches frontend)
    const baseService = booking.base_service_fee || 0;
    const urgencyFee = booking.urgent_fee || 0;
    const bodyCameraFee = booking.body_camera_fee || 0;
    const transportationFee = booking.total_transport_fees || 0;
    const materialsAmount = booking.total_materials_amount || 0;
    
    // Grand total = baseService + urgencyFee + transportationFee + bodyCameraFee
    // This matches frontend calculation exactly (no VAT, no materials in grand_total)
    const grandTotal = baseService + urgencyFee + transportationFee + bodyCameraFee;

    return {
      baseService,
      urgencyFee,
      transportationFee,
      mediaProcessingFee: bodyCameraFee, // Body camera fee
      vatAmount: 0, // VAT computation removed - will be implemented later
      total: grandTotal, // grand_total does NOT include VAT or materials
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