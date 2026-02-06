import { Database } from '../supabase/database.types';

// Enums matching database
export enum BookingStatus {
  FINDING_PROVIDER = 'finding_provider',
  PENDING_ACCEPTANCE = 'pending_acceptance',
  CONFIRMED = 'confirmed',
  ON_THE_WAY = 'on_the_way',
  ARRIVED = 'arrived',
  IN_PROGRESS = 'in_progress',
  PAYMENT_PENDING = 'payment_pending',
  PAID = 'paid',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export type BookingSchedulingType = Database['public']['Enums']['booking_scheduling_type'];
export type MediaType = Database['public']['Enums']['media_type'];
export type MediaContext = Database['public']['Enums']['media_context'];
export type PriceAppliedTier = Database['public']['Enums']['price_applied_tier'];

// Core booking interfaces
export interface BookingSubmissionData {
  serviceType: string;
  description: string;
  urgency: 'emergency' | 'high' | 'medium' | 'low';
  preferredDate: string;
  preferredTimeslot: string;
  preferredDateTime: string; // Combined datetime for backend
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  contactInfo: {
    person: string;
    phone?: string;
  };
  mediaFiles: MediaFile[];
  specialInstructions?: string;
  serviceVariantId?: string; // For pre-selected services
  preSelectedProviderId?: string; // Provider selected from service details page
  bodyCameraRequested?: boolean; // Include variant body_camera_fee when true
}

export interface BookingResponse {
  bookingId: string;
  status: BookingStatus;
  assignedProvider?: ProviderInfo;
  estimatedArrival?: Date;
  trackingUrl: string;
  otpStart?: string;
  otpEnd?: string;
}

// Media file interfaces
export interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
  name: string;
  size: number;
}

export interface UploadedMedia {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: MediaType;
  context: MediaContext;
}

// Provider interfaces
export interface ProviderInfo {
  id: string;
  profile: {
    full_name: string;
    avatar_url?: string;
    phone_number?: string;
  };
  rating: number;
  totalBookings: number;
  location: {
    lat: number;
    lng: number;
  };
  distance?: number; // Distance from booking location in meters
  estimatedArrival?: number; // Estimated arrival time in minutes
  services: string[]; // Service types they provide
  isOnline: boolean;
  currentStatus: 'available' | 'busy' | 'offline';
}

// Status transition interfaces
export interface StatusTransition {
  from: BookingStatus;
  to: BookingStatus;
  allowed: boolean;
  requiresConfirmation?: boolean;
  autoNotify?: boolean;
}

export interface BookingTimelineEntry {
  id: string;
  bookingId: string;
  title: string;
  description?: string;
  iconName?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

// Notification interfaces
export enum NotificationChannel {
  PUSH = 'push',
  SMS = 'sms',
  EMAIL = 'email',
  IN_APP = 'in_app'
}

export enum NotificationType {
  BOOKING_CREATED = 'booking_created',
  PROVIDER_ASSIGNED = 'provider_assigned',
  BOOKING_CONFIRMED = 'booking_confirmed',
  PROVIDER_EN_ROUTE = 'provider_en_route',
  PROVIDER_ARRIVED = 'provider_arrived',
  BOOKING_COMPLETED = 'booking_completed',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_REJECTED = 'booking_rejected'
}

export interface NotificationPayload {
  type: NotificationType;
  bookingId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
}

// Real-time interfaces
export interface BookingCallbacks {
  onBookingUpdate: (booking: any) => void;
  onTimelineUpdate: (entry: BookingTimelineEntry) => void;
  onProviderLocationUpdate?: (location: { lat: number; lng: number; timestamp: Date }) => void;
  onStatusChange?: (status: BookingStatus, metadata?: any) => void;
}

// Error interfaces
export class BookingError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export class ProviderAssignmentError extends BookingError {
  constructor(message: string, public reason: 'no_providers' | 'all_busy' | 'location_unavailable') {
    super(message, 'PROVIDER_ASSIGNMENT_FAILED');
  }
}

export class MediaUploadError extends BookingError {
  constructor(message: string, public fileName?: string) {
    super(message, 'MEDIA_UPLOAD_FAILED');
  }
}

export class InvalidStatusTransitionError extends BookingError {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Invalid status transition from ${from} to ${to}`, 'INVALID_STATUS_TRANSITION');
  }
}

// Provider matching interfaces
export interface ProviderMatchCriteria {
  serviceType: string;
  location: { lat: number; lng: number };
  urgency: 'emergency' | 'high' | 'medium' | 'low';
  requiredSkills?: string[];
  maxDistance?: number; // in meters
  maxArrivalTime?: number; // in minutes
}

export interface ProviderWithScore extends ProviderInfo {
  matchScore: number;
  distanceScore: number;
  ratingScore: number;
  availabilityScore: number;
  urgencyScore: number;
}

// Price calculation interfaces
export interface PriceBreakdown {
  baseService: number;
  urgencyFee: number;
  transportationFee: number;
  mediaProcessingFee: number;
  vatAmount: number;
  total: number;
  tier: PriceAppliedTier;
}

export interface PricingConfig {
  baseRates: Record<string, number>; // serviceType -> base rate
  urgencyMultipliers: Record<string, number>; // urgency -> multiplier
  transportationFee: number;
  mediaProcessingFee: number; // per file
  vatRate: number;
}

// Customer-facing booking interfaces for listing and details
export interface CustomerBooking {
  id: string;
  customer_id: string;
  provider_id: string | null;
  status: BookingStatus;
  booking_type: BookingSchedulingType;
  scheduled_for: string;
  service_location: string;
  address_snapshot: AddressSnapshot;
  total_labor_base: number | null;
  total_transport_fees: number | null;
  total_materials_amount: number | null;
  total_vat_amount: number | null;
  grand_total: number | null;
  platform_fee: number | null;
  provider_earnings: number | null;
  provider_assigned_at: string | null;
  started_travel_at: string | null;
  arrived_at: string | null;
  started_work_at: string | null;
  finished_work_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  otp_start: string | null;
  otp_end: string | null;
  created_at: string;
  updated_at: string | null;
  // Joined relations
  booking_items?: BookingItem[];
  providers?: BookingProvider | null;
  booking_timeline?: BookingTimelineRow[];
  booking_media?: BookingMediaRow[];
}

export interface AddressSnapshot {
  address: string;
  contact_person: string;
  contact_phone?: string;
  special_instructions?: string;
  service_type?: string;
  urgency?: string;
  preferred_date?: string;
  preferred_timeslot?: string;
  description?: string;
}

export interface BookingItem {
  id: string;
  booking_id: string;
  service_variant_id: string;
  variant_name: string;
  base_price: number;
  price_tier_applied: PriceAppliedTier;
  transportation_fee: number;
  vat_amount: number;
  vat_rate_snapshot: number;
  quantity: number;
  total_price: number;
  service_variants?: {
    id: string;
    name: string;
    services?: {
      id: string;
      name: string;
      service_categories?: {
        icon_url: string | null;
      };
    };
  };
}

export interface BookingProvider {
  id: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
    phone_number: string | null;
  };
}

export interface BookingTimelineRow {
  id: string;
  booking_id: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  created_at: string;
}

export interface BookingMediaRow {
  id: string;
  booking_id: string;
  uploader_id: string;
  url: string;
  thumbnail_url: string | null;
  type: MediaType;
  context: MediaContext;
  created_at: string;
}