import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { ProviderBooking } from './provider-booking.service';
import { BookingStatus } from '../models/booking.model';

export interface DashboardStats {
  pendingJobsCount: number;
  activeJobsCount: number;
  todayJobsCount: number;
  todayEarnings: number;
  weekEarnings: number;
  acceptanceRate: number;
  completionRate: number;
}

export interface CalendarJob {
  id: string;
  date: Date;
  time: string;
  title: string;
  status: BookingStatus;
  customerName: string;
  address: string;
  earnings: number;
}

export type NoticeType = 'NEW_JOB' | 'UPCOMING_JOB' | 'OVERDUE_ACTION';

export interface UrgentNotice {
  id: string;
  type: NoticeType;
  title: string;
  message: string;
  bookingId?: string;
  timestamp: Date;
  priority: number; // Higher = more urgent
}

@Injectable({
  providedIn: 'root'
})
export class ProviderDashboardService {
  private supabaseService = inject(SupabaseService);

  /**
   * Get dashboard statistics for a provider
   */
  async getDashboardStats(providerId: string): Promise<DashboardStats> {
    const client = this.supabaseService.client;

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get week's date range
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // Fetch all bookings for calculations
    const { data: bookings, error } = await client
      .from('bookings')
      .select('id, status, scheduled_for, provider_earnings, created_at')
      .eq('provider_id', providerId);

    if (error) {
      console.error('Failed to fetch dashboard stats:', error);
      return {
        pendingJobsCount: 0,
        activeJobsCount: 0,
        todayJobsCount: 0,
        todayEarnings: 0,
        weekEarnings: 0,
        acceptanceRate: 0,
        completionRate: 0
      };
    }

    const allBookings = bookings || [];

    // Count pending jobs
    const pendingJobsCount = allBookings.filter(
      b => b.status === BookingStatus.PENDING_ACCEPTANCE
    ).length;

    // Count active jobs
    const activeStatuses = [
      BookingStatus.CONFIRMED,
      BookingStatus.ON_THE_WAY,
      BookingStatus.ARRIVED,
      BookingStatus.IN_PROGRESS
    ];
    const activeJobsCount = allBookings.filter(
      b => activeStatuses.includes(b.status as BookingStatus)
    ).length;

    // Count today's jobs
    const todayJobsCount = allBookings.filter(b => {
      if (!b.scheduled_for) return false;
      const scheduledDate = new Date(b.scheduled_for);
      return scheduledDate >= todayStart && scheduledDate <= todayEnd;
    }).length;

    // Calculate today's earnings
    const todayEarnings = allBookings
      .filter(b => {
        if (!b.scheduled_for) return false;
        const scheduledDate = new Date(b.scheduled_for);
        return scheduledDate >= todayStart && scheduledDate <= todayEnd &&
          [BookingStatus.COMPLETED, BookingStatus.PAID].includes(b.status as BookingStatus);
      })
      .reduce((sum, b) => sum + (b.provider_earnings || 0), 0);

    // Calculate week's earnings
    const weekEarnings = allBookings
      .filter(b => {
        if (!b.scheduled_for) return false;
        const scheduledDate = new Date(b.scheduled_for);
        return scheduledDate >= weekStart &&
          [BookingStatus.COMPLETED, BookingStatus.PAID].includes(b.status as BookingStatus);
      })
      .reduce((sum, b) => sum + (b.provider_earnings || 0), 0);

    // Calculate acceptance rate
    const totalOffered = allBookings.filter(
      b => b.status !== BookingStatus.FINDING_PROVIDER
    ).length;
    const acceptedCount = allBookings.filter(
      b => ![BookingStatus.REJECTED, BookingStatus.PENDING_ACCEPTANCE, BookingStatus.FINDING_PROVIDER].includes(b.status as BookingStatus)
    ).length;
    const acceptanceRate = totalOffered > 0 ? (acceptedCount / totalOffered) * 100 : 100;

    // Calculate completion rate
    const completedStatuses = [BookingStatus.COMPLETED, BookingStatus.PAID];
    const completedCount = allBookings.filter(
      b => completedStatuses.includes(b.status as BookingStatus)
    ).length;
    const finishedStatuses = [...completedStatuses, BookingStatus.CANCELLED];
    const finishedCount = allBookings.filter(
      b => finishedStatuses.includes(b.status as BookingStatus)
    ).length;
    const completionRate = finishedCount > 0 ? (completedCount / finishedCount) * 100 : 100;

    return {
      pendingJobsCount,
      activeJobsCount,
      todayJobsCount,
      todayEarnings,
      weekEarnings,
      acceptanceRate: Math.round(acceptanceRate),
      completionRate: Math.round(completionRate)
    };
  }

  /**
   * Get today's jobs for a provider
   */
  async getTodayJobs(providerId: string): Promise<ProviderBooking[]> {
    const client = this.supabaseService.client;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

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
          profiles (full_name, avatar_url, phone_number)
        )
      `)
      .eq('provider_id', providerId)
      .gte('scheduled_for', todayStart.toISOString())
      .lte('scheduled_for', todayEnd.toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('Failed to fetch today jobs:', error);
      return [];
    }

    return (data || []) as unknown as ProviderBooking[];
  }

  /**
   * Get upcoming jobs within specified hours
   */
  async getUpcomingJobs(providerId: string, hours: number = 24): Promise<ProviderBooking[]> {
    const client = this.supabaseService.client;

    const now = new Date();
    const future = new Date();
    future.setHours(future.getHours() + hours);

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
          profiles (full_name, avatar_url, phone_number)
        )
      `)
      .eq('provider_id', providerId)
      .gte('scheduled_for', now.toISOString())
      .lte('scheduled_for', future.toISOString())
      .in('status', [
        BookingStatus.PENDING_ACCEPTANCE,
        BookingStatus.CONFIRMED
      ])
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('Failed to fetch upcoming jobs:', error);
      return [];
    }

    return (data || []) as unknown as ProviderBooking[];
  }

  /**
   * Get pending jobs awaiting acceptance
   */
  async getPendingJobs(providerId: string): Promise<ProviderBooking[]> {
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
          profiles (full_name, avatar_url, phone_number)
        )
      `)
      .eq('provider_id', providerId)
      .eq('status', BookingStatus.PENDING_ACCEPTANCE)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch pending jobs:', error);
      return [];
    }

    return (data || []) as unknown as ProviderBooking[];
  }

  /**
   * Get jobs for calendar view within a date range
   */
  async getCalendarJobs(
    providerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarJob[]> {
    const client = this.supabaseService.client;

    const { data, error } = await client
      .from('bookings')
      .select(`
        id,
        status,
        scheduled_for,
        provider_earnings,
        address_snapshot,
        booking_items (
          variant_name,
          service_variants (
            name,
            services (name)
          )
        ),
        customers!bookings_customer_id_fkey (
          profiles (full_name)
        )
      `)
      .eq('provider_id', providerId)
      .gte('scheduled_for', startDate.toISOString())
      .lte('scheduled_for', endDate.toISOString())
      .not('status', 'in', `(${BookingStatus.CANCELLED},${BookingStatus.REJECTED})`)
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('Failed to fetch calendar jobs:', error);
      return [];
    }

    return (data || []).map((booking: any) => {
      const scheduledDate = new Date(booking.scheduled_for);
      const item = booking.booking_items?.[0];
      const serviceName = item?.service_variants?.services?.name ||
        item?.variant_name || 'Service';

      return {
        id: booking.id,
        date: scheduledDate,
        time: scheduledDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        title: serviceName,
        status: booking.status as BookingStatus,
        customerName: booking.customers?.profiles?.full_name || 'Customer',
        address: booking.address_snapshot?.address || 'No address',
        earnings: booking.provider_earnings || 0
      };
    });
  }

  /**
   * Generate urgent notices based on current bookings
   */
  async getUrgentNotices(providerId: string): Promise<UrgentNotice[]> {
    const notices: UrgentNotice[] = [];
    const now = new Date();

    // Get pending jobs
    const pendingJobs = await this.getPendingJobs(providerId);

    // Add notices for pending jobs
    pendingJobs.forEach(job => {
      const createdAt = new Date(job.created_at);
      const minutesPending = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

      if (minutesPending > 15) {
        // Urgent - pending > 15 minutes
        notices.push({
          id: `pending-${job.id}`,
          type: 'OVERDUE_ACTION',
          title: '⚠️ Action Required',
          message: `Job pending for ${minutesPending} mins`,
          bookingId: job.id,
          timestamp: createdAt,
          priority: 3
        });
      } else {
        // New job
        notices.push({
          id: `new-${job.id}`,
          type: 'NEW_JOB',
          title: '🔔 New Job Request',
          message: this.getServiceName(job),
          bookingId: job.id,
          timestamp: createdAt,
          priority: 2
        });
      }
    });

    // Get upcoming jobs (within 1 hour)
    const upcomingJobs = await this.getUpcomingJobs(providerId, 1);

    upcomingJobs
      .filter(job => job.status === BookingStatus.CONFIRMED)
      .forEach(job => {
        const scheduledFor = new Date(job.scheduled_for);
        const minutesUntil = Math.floor((scheduledFor.getTime() - now.getTime()) / 60000);

        if (minutesUntil <= 60 && minutesUntil > 0) {
          notices.push({
            id: `upcoming-${job.id}`,
            type: 'UPCOMING_JOB',
            title: `⏰ Job in ${minutesUntil} min`,
            message: this.getServiceName(job),
            bookingId: job.id,
            timestamp: scheduledFor,
            priority: 1
          });
        }
      });

    // Sort by priority (highest first)
    return notices.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get provider availability status
   */
  async getProviderStatus(providerId: string): Promise<{ isOnline: boolean; status: string }> {
    const client = this.supabaseService.client;

    const { data, error } = await client
      .from('providers')
      .select('status')
      .eq('id', providerId)
      .single();

    if (error || !data) {
      return { isOnline: false, status: 'offline' };
    }

    return {
      isOnline: data.status === 'online',
      status: data.status || 'offline'
    };
  }

  /**
   * Update provider availability status
   */
  async setProviderStatus(providerId: string, isOnline: boolean): Promise<void> {
    const client = this.supabaseService.client;

    const newStatus: 'online' | 'offline' = isOnline ? 'online' : 'offline';

    const { error } = await client
      .from('providers')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', providerId);

    if (error) {
      console.error('Failed to update provider status:', error);
      throw new Error('Failed to update availability status');
    }
  }

  private getServiceName(booking: ProviderBooking): string {
    const item = booking.booking_items?.[0];
    return item?.service_variants?.services?.name || item?.variant_name || 'Service';
  }
}
