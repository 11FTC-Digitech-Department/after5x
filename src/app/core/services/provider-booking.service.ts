import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { devError } from '../utils/logger';
import { SessionService } from '../auth/session';
import { BookingStatusService } from './booking-status.service';
import { BookingStatus, CustomerBooking, BookingError } from '../models/booking.model';

export interface ProviderBooking extends CustomerBooking {
  customers?: {
    profiles?: {
      full_name: string;
      avatar_url: string | null;
      phone_number: string | null;
      email: string | null;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProviderBookingService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private bookingStatusService = inject(BookingStatusService);

  /**
   * Fetch all bookings for a specific provider with optional status filter
   */
  async getProviderBookings(providerId: string, statuses?: BookingStatus[]): Promise<ProviderBooking[]> {
    const client = this.supabaseService.client;

    let query = client
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
        customers!bookings_customer_id_fkey (
          id,
          profiles (full_name, avatar_url, phone_number, email)
        ),
        booking_timeline (*)
      `)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });

    if (statuses && statuses.length > 0) {
      query = query.in('status', statuses);
    }

    const { data, error } = await query;

    if (error) {
      throw new BookingError(`Failed to fetch provider bookings: ${error.message}`, 'FETCH_FAILED');
    }

    return (data || []) as unknown as ProviderBooking[];
  }

  /**
   * Get incoming jobs (PENDING_ACCEPTANCE status)
   */
  async getIncomingJobs(providerId: string): Promise<ProviderBooking[]> {
    return this.getProviderBookings(providerId, [BookingStatus.PENDING_ACCEPTANCE]);
  }

  /**
   * Get active jobs (CONFIRMED, ON_THE_WAY, ARRIVED, IN_PROGRESS)
   */
  async getActiveJobs(providerId: string): Promise<ProviderBooking[]> {
    return this.getProviderBookings(providerId, [
      BookingStatus.CONFIRMED,
      BookingStatus.ON_THE_WAY,
      BookingStatus.ARRIVED,
      BookingStatus.IN_PROGRESS
    ]);
  }

  /**
   * Get completed/historical jobs
   */
  async getHistoricalJobs(providerId: string): Promise<ProviderBooking[]> {
    return this.getProviderBookings(providerId, [
      BookingStatus.PAYMENT_PENDING,
      BookingStatus.PAID,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
      BookingStatus.REJECTED
    ]);
  }

  /**
   * Accept a job - transition from PENDING_ACCEPTANCE to CONFIRMED
   */
  async acceptJob(bookingId: string): Promise<void> {
    const userId = this.sessionService.profile()?.id;
    await this.bookingStatusService.updateBookingStatus(
      bookingId,
      BookingStatus.CONFIRMED,
      { acceptedAt: new Date().toISOString() },
      userId
    );
  }

  /**
   * Reject a job - transition from PENDING_ACCEPTANCE to REJECTED
   */
  async rejectJob(bookingId: string, reason: string): Promise<void> {
    const client = this.supabaseService.client;
    const userId = this.sessionService.profile()?.id;

    // Update booking with rejection details
    const { error } = await client
      .from('bookings')
      .update({
        status: BookingStatus.REJECTED,
        cancellation_reason: reason,
        cancelled_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) {
      throw new BookingError(`Failed to reject job: ${error.message}`, 'REJECT_FAILED');
    }

    // Create timeline entry
    await this.bookingStatusService.createTimelineEntry(
      bookingId,
      BookingStatus.REJECTED,
      { reason },
      userId
    );
  }

  /**
   * Start travel - transition from CONFIRMED to ON_THE_WAY
   */
  async startTravel(bookingId: string): Promise<void> {
    const userId = this.sessionService.profile()?.id;
    await this.bookingStatusService.updateBookingStatus(
      bookingId,
      BookingStatus.ON_THE_WAY,
      { travelStartedAt: new Date().toISOString() },
      userId
    );
  }

  /**
   * Arrive at location - transition from ON_THE_WAY to ARRIVED
   */
  async arriveAtLocation(bookingId: string): Promise<void> {
    const userId = this.sessionService.profile()?.id;
    await this.bookingStatusService.updateBookingStatus(
      bookingId,
      BookingStatus.ARRIVED,
      { arrivedAt: new Date().toISOString() },
      userId
    );
  }

  /**
   * Start work - transition from ARRIVED to IN_PROGRESS
   */
  async startWork(bookingId: string): Promise<void> {
    const userId = this.sessionService.profile()?.id;
    await this.bookingStatusService.updateBookingStatus(
      bookingId,
      BookingStatus.IN_PROGRESS,
      { workStartedAt: new Date().toISOString() },
      userId
    );
  }

  /**
   * Complete work - transition from IN_PROGRESS to PAYMENT_PENDING
   */
  async completeWork(bookingId: string): Promise<void> {
    const userId = this.sessionService.profile()?.id;
    await this.bookingStatusService.updateBookingStatus(
      bookingId,
      BookingStatus.PAYMENT_PENDING,
      { workCompletedAt: new Date().toISOString() },
      userId
    );
  }

  /**
   * Get a single booking by ID with customer details
   */
  async getBookingById(bookingId: string): Promise<ProviderBooking | null> {
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
        customers!bookings_customer_id_fkey (
          id,
          profiles (full_name, avatar_url, phone_number, email)
        ),
        booking_timeline (*),
        booking_media (*)
      `)
      .eq('id', bookingId)
      .single();

    if (error) {
      devError('Failed to fetch booking:', error);
      return null;
    }

    return data as unknown as ProviderBooking;
  }
}
