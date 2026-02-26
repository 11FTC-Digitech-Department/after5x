import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { devLog, devError } from '../utils/logger';

export interface AdminStats {
  totalUsers: number;
  totalCustomers: number;
  totalProviders: number;
  totalBookings: number;
  activeBookings: number;
  totalRevenue: number;
  pendingProviderApplications: number;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
}

export interface AdminProvider {
  id: string;
  status: string;
  verification_status: string;
  rating_avg: number;
  rating_count: number;
  engagement_score: number;
  cancellation_rate: number;
  years_of_experience: number;
  service_radius_km: number;
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
    phone_number: string | null;
  };
}

export interface AdminBooking {
  id: string;
  customer_id: string;
  provider_id: string | null;
  status: string;
  booking_type: string;
  scheduled_for: string;
  grand_total: number;
  platform_fee: number;
  provider_earnings: number;
  created_at: string;
  updated_at: string;
  customer?: { full_name: string; email: string };
  provider?: { profile?: { full_name: string } };
  booking_items?: Array<{ variant_name: string; total_price: number }>;
}

export interface ProviderApplication {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  service_category: string;
  experience_years: number;
  status: string;
  submitted_at: string;
  documents?: any;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private supabaseService = inject(SupabaseService);

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<AdminStats> {
    const client = this.supabaseService.client;

    // Run queries in parallel
    const [usersResult, customersResult, providersResult, bookingsResult, activeBookingsResult, revenueResult, pendingAppsResult] = await Promise.all([
      client.from('profiles').select('id', { count: 'exact', head: true }),
      client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'provider'),
      client.from('bookings').select('id', { count: 'exact', head: true }),
      client.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['confirmed', 'on_the_way', 'arrived', 'in_progress']),
      client.from('bookings').select('grand_total').eq('status', 'paid'),
      client.from('providers').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    ]);

    const totalRevenue = revenueResult.data?.reduce((sum: number, b: any) => sum + (b.grand_total || 0), 0) ?? 0;

    return {
      totalUsers: usersResult.count ?? 0,
      totalCustomers: customersResult.count ?? 0,
      totalProviders: providersResult.count ?? 0,
      totalBookings: bookingsResult.count ?? 0,
      activeBookings: activeBookingsResult.count ?? 0,
      totalRevenue,
      pendingProviderApplications: pendingAppsResult.count ?? 0,
    };
  }

  /**
   * Get all users with pagination
   */
  async getUsers(page: number = 1, pageSize: number = 20, roleFilter?: string, search?: string): Promise<{ data: AdminUser[]; count: number }> {
    const client = this.supabaseService.client;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = (client.from('profiles') as any).select('*', { count: 'exact' });

    if (roleFilter) {
      query = query.eq('role', roleFilter);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);

    if (error) {
      devError('Failed to fetch users:', error);
      throw error;
    }

    return { data: (data as any) ?? [], count: count ?? 0 };
  }

  /**
   * Get all providers with their profiles
   */
  async getProviders(page: number = 1, pageSize: number = 20, statusFilter?: string): Promise<{ data: AdminProvider[]; count: number }> {
    const client = this.supabaseService.client;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = (client.from('providers') as any).select('*, profile:profiles!providers_id_fkey(full_name, email, avatar_url, phone_number)', { count: 'exact' });

    if (statusFilter) {
      query = query.eq('verification_status', statusFilter);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);

    if (error) {
      devError('Failed to fetch providers:', error);
      throw error;
    }

    return { data: (data as any) ?? [], count: count ?? 0 };
  }

  /**
   * Update provider verification status
   */
  async updateProviderVerification(providerId: string, status: string): Promise<void> {
    const client = this.supabaseService.client;
    const { error } = await (client.from('providers') as any).update({ verification_status: status }).eq('id', providerId);

    if (error) {
      devError('Failed to update provider verification:', error);
      throw error;
    }
  }

  /**
   * Get all bookings with related data
   */
  async getBookings(page: number = 1, pageSize: number = 20, statusFilter?: string): Promise<{ data: AdminBooking[]; count: number }> {
    const client = this.supabaseService.client;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = (client.from('bookings') as any).select(`
      *,
      customer:profiles!bookings_customer_id_fkey(full_name, email),
      provider:providers!bookings_provider_id_fkey(profile:profiles!providers_id_fkey(full_name)),
      booking_items(variant_name, total_price)
    `, { count: 'exact' });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);

    if (error) {
      devError('Failed to fetch bookings:', error);
      throw error;
    }

    return { data: (data as any) ?? [], count: count ?? 0 };
  }

  /**
   * Get service categories with services and variants
   */
  async getServiceCatalog(): Promise<any[]> {
    const client = this.supabaseService.client;
    const { data, error } = await client
      .from('service_categories')
      .select('*, services(*, service_variants(*))')
      .order('sort_order', { ascending: true });

    if (error) {
      devError('Failed to fetch service catalog:', error);
      throw error;
    }

    return data ?? [];
  }

  /**
   * Get financial summary
   */
  async getFinancialSummary(): Promise<{ totalRevenue: number; totalPlatformFees: number; totalProviderEarnings: number; bookingsByStatus: Record<string, number> }> {
    const client = this.supabaseService.client;

    const { data, error } = await (client.from('bookings') as any).select('status, grand_total, platform_fee, provider_earnings');

    if (error) {
      devError('Failed to fetch financial summary:', error);
      throw error;
    }

    const bookingsByStatus: Record<string, number> = {};
    let totalRevenue = 0;
    let totalPlatformFees = 0;
    let totalProviderEarnings = 0;

    for (const booking of data ?? []) {
      const status = booking.status ?? 'unknown';
      bookingsByStatus[status] = (bookingsByStatus[status] || 0) + 1;
      if (booking.status === 'paid') {
        totalRevenue += booking.grand_total || 0;
        totalPlatformFees += booking.platform_fee || 0;
        totalProviderEarnings += booking.provider_earnings || 0;
      }
    }

    return { totalRevenue, totalPlatformFees, totalProviderEarnings, bookingsByStatus };
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: string): Promise<void> {
    const client = this.supabaseService.client;
    const { error } = await (client.from('profiles') as any).update({ role }).eq('id', userId);
    if (error) {
      devError('Failed to update user role:', error);
      throw error;
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  }
}
