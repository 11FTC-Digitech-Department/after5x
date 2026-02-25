import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';

// --- Interfaces ---

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'customer' | 'provider' | 'admin';
  activated: boolean;
  phone_number: string | null;
  created_at: string;
}

export interface AdminProvider {
  id: string;
  bio: string | null;
  years_of_experience: number;
  status: string;
  verification_status: string;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  profile: {
    full_name: string;
    email: string;
    avatar_url: string | null;
    activated: boolean;
  } | null;
}

export interface AdminBooking {
  id: string;
  status: string;
  booking_type: string;
  scheduled_for: string;
  grand_total: number | null;
  created_at: string;
  customer: { full_name: string; email: string } | null;
  provider: { full_name: string } | null;
}

export interface AdminBookingDetail {
  id: string;
  status: string;
  booking_type: string;
  scheduled_for: string;
  address_snapshot: any;
  total_labor_base: number | null;
  total_transport_fees: number | null;
  total_materials_amount: number | null;
  total_vat_amount: number | null;
  grand_total: number | null;
  base_service_fee: number | null;
  urgent_fee: number | null;
  body_camera_fee: number | null;
  platform_fee: number | null;
  provider_earnings: number | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string | null;
  customer: { id: string; full_name: string; email: string; phone_number: string | null } | null;
  provider: { id: string; full_name: string; avatar_url: string | null } | null;
  booking_items: any[];
  booking_timeline: any[];
  booking_media: any[];
}

export interface AdminCatalogCategory {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
  services?: AdminCatalogService[];
}

export interface AdminCatalogService {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  variants?: AdminCatalogVariant[];
}

export interface AdminCatalogVariant {
  id: string;
  service_id: string;
  name: string;
  price_min: number;
  price_max: number;
  price_after5_min: number;
  price_after5_max: number;
  duration_minutes: number;
  commission_rate: number;
  vat_rate: number;
  is_active: boolean;
}

export interface AdminStats {
  totalUsers: number;
  totalProviders: number;
  pendingProviders: number;
  totalBookings: number;
  activeBookings: number;
  totalRevenue: number;
  bookingsByStatus: { status: string; count: number }[];
}

// --- Service ---

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private supabaseService = inject(SupabaseService);

  private get client() {
    return this.supabaseService.client as any;
  }

  // --- Dashboard Stats ---

  async getDashboardStats(): Promise<AdminStats> {
    const client = this.client;

    const [
      { count: totalUsers },
      { count: totalProviders },
      { count: pendingProviders },
      { count: totalBookings },
      { count: activeBookings },
      { data: bookingStatuses },
    ] = await Promise.all([
      client.from('profiles').select('*', { count: 'exact', head: true }),
      client.from('providers').select('*', { count: 'exact', head: true }),
      client
        .from('providers')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'pending'),
      client.from('bookings').select('*', { count: 'exact', head: true }),
      client
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['finding_provider', 'pending_acceptance', 'confirmed', 'on_the_way', 'arrived', 'in_progress']),
      client.from('bookings').select('status'),
    ]);

    // Aggregate bookings by status
    const statusCounts: Record<string, number> = {};
    for (const b of bookingStatuses || []) {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    }
    const bookingsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    return {
      totalUsers: totalUsers ?? 0,
      totalProviders: totalProviders ?? 0,
      pendingProviders: pendingProviders ?? 0,
      totalBookings: totalBookings ?? 0,
      activeBookings: activeBookings ?? 0,
      totalRevenue: 0, // Calculated separately if needed
      bookingsByStatus,
    };
  }

  /** Bookings in the next 7 days and past 7 days for dashboard. */
  async getDashboardBookings(): Promise<AdminBooking[]> {
    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.client
      .from('bookings')
      .select(`
        id, status, booking_type, scheduled_for, grand_total, created_at,
        customer:customers!bookings_customer_id_fkey(profiles!customers_id_fkey(full_name, email)),
        provider:providers(profiles!providers_id_fkey(full_name))
      `)
      .gte('scheduled_for', past)
      .lte('scheduled_for', future)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (error) throw new Error(error.message);

    return ((data || []) as any[]).map((b: any) => ({
      ...b,
      customer: b.customer?.profiles || null,
      provider: b.provider?.profiles || null,
    }));
  }

  // --- Users ---

  async getUsers(options: { page?: number; pageSize?: number; search?: string; role?: string } = {}): Promise<AdminUser[]> {
    const { page = 0, pageSize = 20, search, role } = options;
    let query = this.client
      .from('profiles')
      .select('id, email, full_name, role, activated, phone_number, created_at')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as AdminUser[];
  }

  async updateUserRole(userId: string, role: 'customer' | 'provider' | 'admin'): Promise<void> {
    const { error } = await this.client
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw new Error(error.message);
  }

  async setUserActivated(userId: string, activated: boolean): Promise<void> {
    const { error } = await this.client
      .from('profiles')
      .update({ activated, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw new Error(error.message);
  }

  // --- Providers ---

  async getProviders(options: { page?: number; pageSize?: number; search?: string; verificationStatus?: string } = {}): Promise<AdminProvider[]> {
    const { page = 0, pageSize = 20, search, verificationStatus } = options;
    let query = this.client
      .from('providers')
      .select(`
        id, bio, years_of_experience, status, verification_status,
        rating_avg, rating_count, created_at,
        profile:profiles!providers_id_fkey(full_name, email, avatar_url, activated)
      `)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (verificationStatus) {
      query = query.eq('verification_status', verificationStatus);
    }
    if (search) {
      query = query.ilike('profile.full_name', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as AdminProvider[];
  }

  async updateProviderVerification(providerId: string, status: 'verified' | 'rejected' | 'pending'): Promise<void> {
    const { error } = await this.client
      .from('providers')
      .update({ verification_status: status, updated_at: new Date().toISOString() })
      .eq('id', providerId);
    if (error) throw new Error(error.message);
  }

  async setProviderStatus(providerId: string, status: 'online' | 'offline' | 'suspended'): Promise<void> {
    const { error } = await this.client
      .from('providers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', providerId);
    if (error) throw new Error(error.message);
  }

  async setProviderActivated(providerId: string, activated: boolean): Promise<void> {
    return this.setUserActivated(providerId, activated);
  }

  // --- Bookings ---

  async getBookings(options: { page?: number; pageSize?: number; status?: string } = {}): Promise<AdminBooking[]> {
    const { page = 0, pageSize = 20, status } = options;
    let query = this.client
      .from('bookings')
      .select(`
        id, status, booking_type, scheduled_for, grand_total, created_at,
        customer:customers!bookings_customer_id_fkey(profiles!customers_id_fkey(full_name, email)),
        provider:providers(profiles!providers_id_fkey(full_name))
      `)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ((data || []) as any[]).map((b: any) => ({
      ...b,
      customer: b.customer?.profiles || null,
      provider: b.provider?.profiles || null,
    }));
  }

  async getBookingDetail(bookingId: string): Promise<AdminBookingDetail> {
    const { data, error } = await this.client
      .from('bookings')
      .select(`
        id, status, booking_type, scheduled_for, address_snapshot,
        total_labor_base, total_transport_fees, total_materials_amount,
        total_vat_amount, grand_total, base_service_fee, urgent_fee,
        body_camera_fee, platform_fee, provider_earnings,
        cancellation_reason, created_at, updated_at,
        customer:customers!bookings_customer_id_fkey(id, profiles!customers_id_fkey(full_name, email, phone_number)),
        provider:providers(id, profiles!providers_id_fkey(full_name, avatar_url)),
        booking_items(*, service_variants(id, name, services(id, name))),
        booking_timeline(*),
        booking_media(*)
      `)
      .eq('id', bookingId)
      .single();

    if (error) throw new Error(error.message);

    return {
      ...data,
      customer: data.customer
        ? {
            id: data.customer.id,
            full_name: data.customer.profiles?.full_name || '',
            email: data.customer.profiles?.email || '',
            phone_number: data.customer.profiles?.phone_number || null,
          }
        : null,
      provider: data.provider
        ? {
            id: data.provider.id,
            full_name: data.provider.profiles?.full_name || '',
            avatar_url: data.provider.profiles?.avatar_url || null,
          }
        : null,
    } as AdminBookingDetail;
  }

  async updateBookingStatus(bookingId: string, status: string, reason?: string): Promise<void> {
    const update: any = { status, updated_at: new Date().toISOString() };
    if (reason) {
      update.cancellation_reason = reason;
    }
    const { error } = await this.client
      .from('bookings')
      .update(update)
      .eq('id', bookingId);
    if (error) throw new Error(error.message);
  }

  // --- Service Catalog ---

  async getCatalog(): Promise<AdminCatalogCategory[]> {
    const { data: categories, error: catError } = await this.client
      .from('service_categories')
      .select('id, name, description, icon_url, sort_order, is_active')
      .order('sort_order');

    if (catError) throw new Error(catError.message);

    const { data: services, error: svcError } = await this.client
      .from('services')
      .select('id, category_id, name, description, sort_order, is_active')
      .order('sort_order');

    if (svcError) throw new Error(svcError.message);

    const { data: variants, error: varError } = await this.client
      .from('service_variants')
      .select('id, service_id, name, price_min, price_max, price_after5_min, price_after5_max, duration_minutes, commission_rate, vat_rate, is_active')
      .order('name');

    if (varError) throw new Error(varError.message);

    const variantsByService = new Map<string, AdminCatalogVariant[]>();
    for (const v of variants || []) {
      const list = variantsByService.get(v.service_id) || [];
      list.push(v as AdminCatalogVariant);
      variantsByService.set(v.service_id, list);
    }

    const servicesByCategory = new Map<string, AdminCatalogService[]>();
    for (const s of services || []) {
      const svc = { ...s, variants: variantsByService.get(s.id) || [] } as AdminCatalogService;
      const list = servicesByCategory.get(s.category_id) || [];
      list.push(svc);
      servicesByCategory.set(s.category_id, list);
    }

    return ((categories || []) as AdminCatalogCategory[]).map((cat) => ({
      ...cat,
      services: servicesByCategory.get(cat.id) || [],
    }));
  }

  async createCategory(data: Partial<AdminCatalogCategory>): Promise<void> {
    const { error } = await this.client.from('service_categories').insert(data);
    if (error) throw new Error(error.message);
  }

  async updateCategory(id: string, data: Partial<AdminCatalogCategory>): Promise<void> {
    const { error } = await this.client.from('service_categories').update(data).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await this.client.from('service_categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async createService(data: Partial<AdminCatalogService>): Promise<void> {
    const { error } = await this.client.from('services').insert(data);
    if (error) throw new Error(error.message);
  }

  async updateService(id: string, data: Partial<AdminCatalogService>): Promise<void> {
    const { error } = await this.client.from('services').update(data).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteService(id: string): Promise<void> {
    const { error } = await this.client.from('services').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async createVariant(data: Partial<AdminCatalogVariant>): Promise<void> {
    const { error } = await this.client.from('service_variants').insert(data);
    if (error) throw new Error(error.message);
  }

  async updateVariant(id: string, data: Partial<AdminCatalogVariant>): Promise<void> {
    const { error } = await this.client.from('service_variants').update(data).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteVariant(id: string): Promise<void> {
    const { error } = await this.client.from('service_variants').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
