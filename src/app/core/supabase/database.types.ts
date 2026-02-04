export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          business_permit_no: string | null
          commission_rate: number | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          total_bookings_processed: number | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          business_permit_no?: string | null
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          total_bookings_processed?: number | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          business_permit_no?: string | null
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          total_bookings_processed?: number | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "agencies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "view_user_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          banner_url: string | null
          content: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_pinned: boolean | null
          is_published: boolean | null
          published_at: string | null
          summary: string | null
          target_roles: Database["public"]["Enums"]["app_role"][] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          banner_url?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          summary?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          banner_url?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          summary?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_chats: {
        Row: {
          booking_id: string
          content: string
          created_at: string | null
          id: string
          is_archived: boolean | null
          message_type: Database["public"]["Enums"]["chat_message_type"] | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          booking_id: string
          content: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          message_type?: Database["public"]["Enums"]["chat_message_type"] | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          booking_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          message_type?: Database["public"]["Enums"]["chat_message_type"] | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_chats_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_chats_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_chats_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_gps_logs: {
        Row: {
          battery_level: number | null
          booking_id: string
          heading: number | null
          id: string
          location: unknown
          provider_id: string
          recorded_at: string | null
          speed_kmh: number | null
        }
        Insert: {
          battery_level?: number | null
          booking_id: string
          heading?: number | null
          id?: string
          location: unknown
          provider_id: string
          recorded_at?: string | null
          speed_kmh?: number | null
        }
        Update: {
          battery_level?: number | null
          booking_id?: string
          heading?: number | null
          id?: string
          location?: unknown
          provider_id?: string
          recorded_at?: string | null
          speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_gps_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_gps_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_gps_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_gps_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "view_provider_stats_dashboard"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      booking_items: {
        Row: {
          base_price: number
          booking_id: string
          created_at: string | null
          id: string
          price_tier_applied: Database["public"]["Enums"]["price_applied_tier"]
          quantity: number | null
          service_variant_id: string | null
          total_price: number | null
          transportation_fee: number
          variant_name: string
          vat_amount: number
          vat_rate_snapshot: number | null
        }
        Insert: {
          base_price?: number
          booking_id: string
          created_at?: string | null
          id?: string
          price_tier_applied?: Database["public"]["Enums"]["price_applied_tier"]
          quantity?: number | null
          service_variant_id?: string | null
          total_price?: number | null
          transportation_fee?: number
          variant_name: string
          vat_amount?: number
          vat_rate_snapshot?: number | null
        }
        Update: {
          base_price?: number
          booking_id?: string
          created_at?: string | null
          id?: string
          price_tier_applied?: Database["public"]["Enums"]["price_applied_tier"]
          quantity?: number | null
          service_variant_id?: string | null
          total_price?: number | null
          transportation_fee?: number
          variant_name?: string
          vat_amount?: number
          vat_rate_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_items_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_materials: {
        Row: {
          added_at: string | null
          booking_id: string
          catalog_item_id: string | null
          id: string
          is_customer_approved: boolean | null
          name: string
          quantity: number | null
          total_price: number | null
          unit_price: number
        }
        Insert: {
          added_at?: string | null
          booking_id: string
          catalog_item_id?: string | null
          id?: string
          is_customer_approved?: boolean | null
          name: string
          quantity?: number | null
          total_price?: number | null
          unit_price: number
        }
        Update: {
          added_at?: string | null
          booking_id?: string
          catalog_item_id?: string | null
          id?: string
          is_customer_approved?: boolean | null
          name?: string
          quantity?: number | null
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_materials_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_materials_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_materials_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "materials_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_media: {
        Row: {
          booking_id: string
          captured_at_location: unknown
          context: Database["public"]["Enums"]["media_context"]
          created_at: string | null
          description: string | null
          id: string
          media_url: string
          thumbnail_url: string | null
          type: Database["public"]["Enums"]["media_type"] | null
          uploader_id: string
        }
        Insert: {
          booking_id: string
          captured_at_location?: unknown
          context: Database["public"]["Enums"]["media_context"]
          created_at?: string | null
          description?: string | null
          id?: string
          media_url: string
          thumbnail_url?: string | null
          type?: Database["public"]["Enums"]["media_type"] | null
          uploader_id: string
        }
        Update: {
          booking_id?: string
          captured_at_location?: unknown
          context?: Database["public"]["Enums"]["media_context"]
          created_at?: string | null
          description?: string | null
          id?: string
          media_url?: string
          thumbnail_url?: string | null
          type?: Database["public"]["Enums"]["media_type"] | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_media_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_media_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_media_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_route_plans: {
        Row: {
          booking_id: string
          created_at: string | null
          destination_point: unknown
          encoded_polyline: string
          estimated_distance_meters: number | null
          estimated_duration_seconds: number | null
          id: string
          origin_point: unknown
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          destination_point?: unknown
          encoded_polyline: string
          estimated_distance_meters?: number | null
          estimated_duration_seconds?: number | null
          id?: string
          origin_point?: unknown
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          destination_point?: unknown
          encoded_polyline?: string
          estimated_distance_meters?: number | null
          estimated_duration_seconds?: number | null
          id?: string
          origin_point?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "booking_route_plans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_route_plans_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      booking_timeline: {
        Row: {
          booking_id: string
          created_at: string | null
          description: string | null
          icon_name: string | null
          id: string
          title: string
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          title: string
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_timeline_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_timeline_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      bookings: {
        Row: {
          address_snapshot: Json
          arrived_at: string | null
          booking_type: Database["public"]["Enums"]["booking_scheduling_type"]
          cancellation_reason: string | null
          cancelled_by: string | null
          created_at: string | null
          customer_id: string
          finished_work_at: string | null
          grand_total: number | null
          id: string
          otp_end: string | null
          otp_start: string | null
          platform_fee: number | null
          provider_assigned_at: string | null
          provider_earnings: number | null
          provider_id: string | null
          scheduled_for: string
          service_location: unknown
          started_travel_at: string | null
          started_work_at: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          total_labor_base: number | null
          total_materials_amount: number | null
          total_transport_fees: number | null
          total_vat_amount: number | null
          updated_at: string | null
        }
        Insert: {
          address_snapshot: Json
          arrived_at?: string | null
          booking_type: Database["public"]["Enums"]["booking_scheduling_type"]
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          customer_id: string
          finished_work_at?: string | null
          grand_total?: number | null
          id?: string
          otp_end?: string | null
          otp_start?: string | null
          platform_fee?: number | null
          provider_assigned_at?: string | null
          provider_earnings?: number | null
          provider_id?: string | null
          scheduled_for: string
          service_location: unknown
          started_travel_at?: string | null
          started_work_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_labor_base?: number | null
          total_materials_amount?: number | null
          total_transport_fees?: number | null
          total_vat_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          address_snapshot?: Json
          arrived_at?: string | null
          booking_type?: Database["public"]["Enums"]["booking_scheduling_type"]
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          customer_id?: string
          finished_work_at?: string | null
          grand_total?: number | null
          id?: string
          otp_end?: string | null
          otp_start?: string | null
          platform_fee?: number | null
          provider_assigned_at?: string | null
          provider_earnings?: number | null
          provider_id?: string | null
          scheduled_for?: string
          service_location?: unknown
          started_travel_at?: string | null
          started_work_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_labor_base?: number | null
          total_materials_amount?: number | null
          total_transport_fees?: number | null
          total_vat_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "view_provider_stats_dashboard"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      customers: {
        Row: {
          bookings_count: number | null
          created_at: string | null
          id: string
          total_spend: number | null
          updated_at: string | null
          xendit_customer_id: string | null
        }
        Insert: {
          bookings_count?: number | null
          created_at?: string | null
          id: string
          total_spend?: number | null
          updated_at?: string | null
          xendit_customer_id?: string | null
        }
        Update: {
          bookings_count?: number | null
          created_at?: string | null
          id?: string
          total_spend?: number | null
          updated_at?: string | null
          xendit_customer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          app_type: string
          created_at: string | null
          device_id: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_type: string
          created_at?: string | null
          device_id?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          platform: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_type?: string
          created_at?: string | null
          device_id?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          customer_id: string
          expires_at: string | null
          fees_paid_amount: number | null
          id: string
          paid_at: string | null
          payment_channel: string | null
          payment_method: string | null
          payment_method_type:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          updated_at: string | null
          xendit_external_id: string | null
          xendit_invoice_id: string | null
          xendit_invoice_url: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          customer_id: string
          expires_at?: string | null
          fees_paid_amount?: number | null
          id?: string
          paid_at?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          payment_method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          updated_at?: string | null
          xendit_external_id?: string | null
          xendit_invoice_id?: string | null
          xendit_invoice_url?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          customer_id?: string
          expires_at?: string | null
          fees_paid_amount?: number | null
          id?: string
          paid_at?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          payment_method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          updated_at?: string | null
          xendit_external_id?: string | null
          xendit_invoice_id?: string | null
          xendit_invoice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      materials_catalog: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_price_variable: boolean | null
          name: string
          unit_measurement: string | null
          unit_price: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_price_variable?: boolean | null
          name: string
          unit_measurement?: string | null
          unit_price?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_price_variable?: boolean | null
          name?: string
          unit_measurement?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_catalog_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          booking_id: string | null
          channel: string
          delivery_status: string | null
          error_message: string | null
          fcm_message_id: string | null
          fcm_response: Json | null
          id: string
          metadata: Json | null
          notification_type: string
          recipient_id: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          booking_id?: string | null
          channel: string
          delivery_status?: string | null
          error_message?: string | null
          fcm_message_id?: string | null
          fcm_response?: Json | null
          id?: string
          metadata?: Json | null
          notification_type: string
          recipient_id: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          booking_id?: string | null
          channel?: string
          delivery_status?: string | null
          error_message?: string | null
          fcm_message_id?: string | null
          fcm_response?: Json | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          recipient_id?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "notification_logs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          booking_cancelled: boolean | null
          booking_completed: boolean | null
          booking_confirmed: boolean | null
          booking_started: boolean | null
          created_at: string | null
          id: string
          job_cancelled: boolean | null
          job_confirmed: boolean | null
          job_reminder: boolean | null
          new_job: boolean | null
          news_updates: boolean | null
          payment_received: boolean | null
          payout_processed: boolean | null
          promotions: boolean | null
          provider_arrived: boolean | null
          provider_on_way: boolean | null
          push_enabled: boolean | null
          reviews: boolean | null
          updated_at: string | null
          user_id: string
          verification_status: boolean | null
        }
        Insert: {
          booking_cancelled?: boolean | null
          booking_completed?: boolean | null
          booking_confirmed?: boolean | null
          booking_started?: boolean | null
          created_at?: string | null
          id?: string
          job_cancelled?: boolean | null
          job_confirmed?: boolean | null
          job_reminder?: boolean | null
          new_job?: boolean | null
          news_updates?: boolean | null
          payment_received?: boolean | null
          payout_processed?: boolean | null
          promotions?: boolean | null
          provider_arrived?: boolean | null
          provider_on_way?: boolean | null
          push_enabled?: boolean | null
          reviews?: boolean | null
          updated_at?: string | null
          user_id: string
          verification_status?: boolean | null
        }
        Update: {
          booking_cancelled?: boolean | null
          booking_completed?: boolean | null
          booking_confirmed?: boolean | null
          booking_started?: boolean | null
          created_at?: string | null
          id?: string
          job_cancelled?: boolean | null
          job_confirmed?: boolean | null
          job_reminder?: boolean | null
          new_job?: boolean | null
          news_updates?: boolean | null
          payment_received?: boolean | null
          payout_processed?: boolean | null
          promotions?: boolean | null
          provider_arrived?: boolean | null
          provider_on_way?: boolean | null
          push_enabled?: boolean | null
          reviews?: boolean | null
          updated_at?: string | null
          user_id?: string
          verification_status?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read: boolean | null
          read_at: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          read_at?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          breakdown_details: Json | null
          created_at: string | null
          id: string
          processed_at: string | null
          proof_of_transfer_url: string | null
          provider_id: string
          status: Database["public"]["Enums"]["payout_status"] | null
          xendit_disbursement_id: string | null
        }
        Insert: {
          amount: number
          breakdown_details?: Json | null
          created_at?: string | null
          id?: string
          processed_at?: string | null
          proof_of_transfer_url?: string | null
          provider_id: string
          status?: Database["public"]["Enums"]["payout_status"] | null
          xendit_disbursement_id?: string | null
        }
        Update: {
          amount?: number
          breakdown_details?: Json | null
          created_at?: string | null
          id?: string
          processed_at?: string | null
          proof_of_transfer_url?: string | null
          provider_id?: string
          status?: Database["public"]["Enums"]["payout_status"] | null
          xendit_disbursement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "view_provider_stats_dashboard"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      profiles: {
        Row: {
          activated: boolean | null
          avatar_url: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          fcm_token: string | null
          full_name: string
          id: string
          last_sign_in_at: string | null
          phone_number: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          activated?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          fcm_token?: string | null
          full_name: string
          id: string
          last_sign_in_at?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          activated?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          fcm_token?: string | null
          full_name?: string
          id?: string
          last_sign_in_at?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      provider_offerings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          provider_id: string
          service_variant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_id: string
          service_variant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_id?: string
          service_variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_offerings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_offerings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "view_provider_stats_dashboard"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_offerings_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_schedule_exceptions: {
        Row: {
          created_at: string | null
          end_time: string | null
          id: string
          is_available: boolean | null
          provider_id: string
          reason: string | null
          specific_date: string
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_available?: boolean | null
          provider_id: string
          reason?: string | null
          specific_date: string
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_available?: boolean | null
          provider_id?: string
          reason?: string | null
          specific_date?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_schedule_exceptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_schedule_exceptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "view_provider_stats_dashboard"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      provider_weekly_schedules: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          provider_id: string
          start_time: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          provider_id: string
          start_time: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          provider_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_weekly_schedules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_weekly_schedules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "view_provider_stats_dashboard"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      providers: {
        Row: {
          agency_id: string | null
          bio: string | null
          cancellation_rate: number | null
          created_at: string | null
          current_location: unknown
          engagement_score: number | null
          has_smartphone: boolean | null
          id: string
          online_since: string | null
          rating_avg: number | null
          rating_count: number | null
          search_vector: unknown
          service_radius_km: number | null
          status: Database["public"]["Enums"]["provider_status"] | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          years_of_experience: number | null
        }
        Insert: {
          agency_id?: string | null
          bio?: string | null
          cancellation_rate?: number | null
          created_at?: string | null
          current_location?: unknown
          engagement_score?: number | null
          has_smartphone?: boolean | null
          id: string
          online_since?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          search_vector?: unknown
          service_radius_km?: number | null
          status?: Database["public"]["Enums"]["provider_status"] | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          years_of_experience?: number | null
        }
        Update: {
          agency_id?: string | null
          bio?: string | null
          cancellation_rate?: number | null
          created_at?: string | null
          current_location?: unknown
          engagement_score?: number | null
          has_smartphone?: boolean | null
          id?: string
          online_since?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          search_vector?: unknown
          service_radius_km?: number | null
          status?: Database["public"]["Enums"]["provider_status"] | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string | null
          id: string
          is_public: boolean | null
          rating: number
          reviewer_id: string
          tags: string[] | null
          target_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          rating: number
          reviewer_id: string
          tags?: string[] | null
          target_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          rating?: number
          reviewer_id?: string
          tags?: string[] | null
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          cancellation_fee: number | null
          created_at: string | null
          icon_url: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          cancellation_fee?: number | null
          created_at?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          cancellation_fee?: number | null
          created_at?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      service_variants: {
        Row: {
          body_camera_fee: number | null
          commission_rate: number | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
          price_after5_max: number
          price_after5_min: number
          price_max: number
          price_min: number
          properties: Json | null
          service_id: string
          transportation_fee: number | null
          transportation_fee_after5: number | null
          urgent_charge: number | null
          updated_at: string | null
          vat_rate: number | null
        }
        Insert: {
          body_camera_fee?: number | null
          commission_rate?: number | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price_after5_max?: number
          price_after5_min?: number
          price_max?: number
          price_min?: number
          properties?: Json | null
          service_id: string
          transportation_fee?: number | null
          transportation_fee_after5?: number | null
          urgent_charge?: number | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          body_camera_fee?: number | null
          commission_rate?: number | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_after5_max?: number
          price_after5_min?: number
          price_max?: number
          price_min?: number
          properties?: Json | null
          service_id?: string
          transportation_fee?: number | null
          transportation_fee_after5?: number | null
          urgent_charge?: number | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          booking_form_schema: Json | null
          category_id: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          updated_at: string | null
          variant_selection_schema: Json | null
        }
        Insert: {
          booking_form_schema?: Json | null
          category_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          variant_selection_schema?: Json | null
        }
        Update: {
          booking_form_schema?: Json | null
          category_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          variant_selection_schema?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          attachments: string[] | null
          content: string
          created_at: string | null
          id: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachments?: string[] | null
          content: string
          created_at?: string | null
          id?: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachments?: string[] | null
          content?: string
          created_at?: string | null
          id?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          booking_id: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string | null
          id: string
          priority: string | null
          requester_id: string
          status: Database["public"]["Enums"]["ticket_status"] | null
          subject: string
          ticket_ref_id: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          booking_id?: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at?: string | null
          id?: string
          priority?: string | null
          requester_id: string
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subject: string
          ticket_ref_id: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          booking_id?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string | null
          id?: string
          priority?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subject?: string
          ticket_ref_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "support_tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      time_slots: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          name: string
          sort_order: number | null
          start_time: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          name: string
          sort_order?: number | null
          start_time: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          name?: string
          sort_order?: number | null
          start_time?: string
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          access_instructions: string | null
          created_at: string | null
          full_address: string
          has_parking: boolean | null
          id: string
          is_default: boolean | null
          label: string
          latitude: number
          location: unknown
          longitude: number
          parking_instructions: string | null
          unit_details: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_instructions?: string | null
          created_at?: string | null
          full_address: string
          has_parking?: boolean | null
          id?: string
          is_default?: boolean | null
          label?: string
          latitude: number
          location: unknown
          longitude: number
          parking_instructions?: string | null
          unit_details?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_instructions?: string | null
          created_at?: string | null
          full_address?: string
          has_parking?: boolean | null
          id?: string
          is_default?: boolean | null
          label?: string
          latitude?: number
          location?: unknown
          longitude?: number
          parking_instructions?: string | null
          unit_details?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_payment_methods: {
        Row: {
          card_brand: string | null
          created_at: string | null
          expiry_month: number | null
          expiry_year: number | null
          id: string
          is_default: boolean | null
          masked_card_number: string | null
          payment_method_id: string
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          masked_card_number?: string | null
          payment_method_id: string
          user_id: string
        }
        Update: {
          card_brand?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          masked_card_number?: string | null
          payment_method_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          booking_id: string | null
          created_at: string | null
          description: string | null
          id: string
          invoice_id: string | null
          reference_id: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          reference_id?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          reference_id?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "view_customer_bookings_detailed"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "wallet_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          currency: string | null
          frozen_balance: number | null
          id: string
          last_transaction_at: string | null
          owner_id: string
          owner_type: string | null
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          frozen_balance?: number | null
          id?: string
          last_transaction_at?: string | null
          owner_id: string
          owner_type?: string | null
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          frozen_balance?: number | null
          id?: string
          last_transaction_at?: string | null
          owner_id?: string
          owner_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      view_admin_system_health: {
        Row: {
          active_jobs_now: number | null
          all_time_gmv: number | null
          total_customers: number | null
          verified_providers: number | null
        }
        Relationships: []
      }
      view_customer_bookings_detailed: {
        Row: {
          agency_id: string | null
          booking_id: string | null
          booking_type:
            | Database["public"]["Enums"]["booking_scheduling_type"]
            | null
          created_at: string | null
          grand_total: number | null
          has_reviewed: boolean | null
          payment_status: Database["public"]["Enums"]["invoice_status"] | null
          provider_avatar: string | null
          provider_name: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          xendit_invoice_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      view_provider_earnings_monthly: {
        Row: {
          month_start: string | null
          provider_id: string | null
          total_earnings: number | null
          total_jobs: number | null
          total_reimbursements: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "view_provider_stats_dashboard"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      view_provider_slot_availability: {
        Row: {
          day_of_week: number | null
          provider_id: string | null
          slot_end: string | null
          slot_id: string | null
          slot_name: string | null
          slot_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_weekly_schedules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_weekly_schedules_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "view_provider_stats_dashboard"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      view_provider_stats_dashboard: {
        Row: {
          active_jobs_count: number | null
          earnings_today: number | null
          jobs_completed_30d: number | null
          provider_id: string | null
          rating_avg: number | null
          rating_count: number | null
          status: Database["public"]["Enums"]["provider_status"] | null
        }
        Insert: {
          active_jobs_count?: never
          earnings_today?: never
          jobs_completed_30d?: never
          provider_id?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          status?: Database["public"]["Enums"]["provider_status"] | null
        }
        Update: {
          active_jobs_count?: never
          earnings_today?: never
          jobs_completed_30d?: never
          provider_id?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          status?: Database["public"]["Enums"]["provider_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      view_user_announcements: {
        Row: {
          banner_url: string | null
          id: string | null
          is_pinned: boolean | null
          is_read: boolean | null
          published_at: string | null
          summary: string | null
          title: string | null
        }
        Insert: {
          banner_url?: string | null
          id?: string | null
          is_pinned?: boolean | null
          is_read?: never
          published_at?: string | null
          summary?: string | null
          title?: string | null
        }
        Update: {
          banner_url?: string | null
          id?: string | null
          is_pinned?: boolean | null
          is_read?: never
          published_at?: string | null
          summary?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      clean_old_notifications: { Args: never; Returns: undefined }
      create_booking_item: {
        Args: {
          p_base_price: number
          p_booking_id: string
          p_price_tier: string
          p_service_variant_id: string
          p_transportation_fee: number
          p_variant_name: string
          p_vat_rate: number
        }
        Returns: string
      }
      create_booking_timeline_entry: {
        Args: {
          p_booking_id: string
          p_description: string
          p_icon_name?: string
          p_metadata?: Json
          p_title: string
        }
        Returns: string
      }
      create_invoice_record: {
        Args: {
          p_amount: number
          p_booking_id: string
          p_customer_id: string
          p_expires_at: string
          p_xendit_external_id: string
          p_xendit_invoice_id: string
          p_xendit_invoice_url: string
        }
        Returns: string
      }
      credit_provider_wallet: {
        Args: { p_booking_id: string; p_invoice_id: string }
        Returns: undefined
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      dropgeometrytable:
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      enablelongtransactions: { Args: never; Returns: string }
      ensure_customer_record: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_available_providers: {
        Args: {
          p_lat: number
          p_lng: number
          p_max_distance?: number
          p_service_type: string
        }
        Returns: {
          distance_meters: number
          estimated_arrival_minutes: number
          is_online: boolean
          provider_id: string
          provider_name: string
          provider_rating: number
        }[]
      }
      get_invoice_by_booking: {
        Args: { p_booking_id: string }
        Returns: {
          amount: number
          expires_at: string
          id: string
          paid_at: string
          payment_channel: string
          payment_method: string
          status: Database["public"]["Enums"]["invoice_status"]
          xendit_invoice_id: string
          xendit_invoice_url: string
        }[]
      }
      get_or_create_notification_preferences: {
        Args: { p_user_id: string }
        Returns: {
          booking_cancelled: boolean | null
          booking_completed: boolean | null
          booking_confirmed: boolean | null
          booking_started: boolean | null
          created_at: string | null
          id: string
          job_cancelled: boolean | null
          job_confirmed: boolean | null
          job_reminder: boolean | null
          new_job: boolean | null
          news_updates: boolean | null
          payment_received: boolean | null
          payout_processed: boolean | null
          promotions: boolean | null
          provider_arrived: boolean | null
          provider_on_way: boolean | null
          push_enabled: boolean | null
          reviews: boolean | null
          updated_at: string | null
          user_id: string
          verification_status: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_xendit_customer: {
        Args: { p_customer_id: string }
        Returns: string
      }
      get_provider_wallet: {
        Args: { p_provider_id: string }
        Returns: {
          balance: number
          currency: string
          frozen_balance: number
          last_transaction_at: string
          wallet_id: string
        }[]
      }
      get_user_notifications: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          data: Json
          id: string
          message: string
          read: boolean
          read_at: string
          title: string
          type: string
        }[]
      }
      get_wallet_transactions: {
        Args: { p_limit?: number; p_offset?: number; p_provider_id: string }
        Returns: {
          amount: number
          balance_after: number
          booking_id: string
          created_at: string
          description: string
          id: string
          type: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      increment_provider_bookings: {
        Args: { provider_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_agency_owner_of_provider: {
        Args: { target_provider_id: string }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_notification_read: {
        Args: { notification_id: string }
        Returns: boolean
      }
      populate_geometry_columns:
        | { Args: { use_typmod?: boolean }; Returns: string }
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      send_push_notification_async: {
        Args: {
          p_app_type: string
          p_body: string
          p_booking_id: string
          p_title: string
          p_type: string
          p_user_ids: string[]
        }
        Returns: undefined
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_askml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geom: unknown }; Returns: number }
        | { Args: { geog: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_booking_payment_status: {
        Args: { p_booking_id: string; p_new_status: string }
        Returns: undefined
      }
      update_invoice_expired: {
        Args: { p_xendit_invoice_id: string }
        Returns: string
      }
      update_invoice_paid: {
        Args: {
          p_fees_paid: number
          p_payment_channel: string
          p_payment_method: string
          p_payment_method_type: Database["public"]["Enums"]["payment_method_type"]
          p_xendit_invoice_id: string
        }
        Returns: string
      }
      update_provider_rating: {
        Args: { provider_id: string }
        Returns: undefined
      }
      update_provider_status_for_booking: {
        Args: {
          p_booking_id?: string
          p_new_status: Database["public"]["Enums"]["provider_status"]
          p_provider_id: string
        }
        Returns: undefined
      }
      update_xendit_customer_id: {
        Args: { p_customer_id: string; p_xendit_customer_id: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "customer" | "provider" | "agency_admin"
      booking_scheduling_type: "ASAP" | "SCHEDULED"
      booking_status:
        | "finding_provider"
        | "pending_acceptance"
        | "confirmed"
        | "on_the_way"
        | "arrived"
        | "in_progress"
        | "payment_pending"
        | "paid"
        | "cancelled"
        | "rejected"
        | "expired"
        | "completed"
      chat_message_type: "TEXT" | "IMAGE" | "LOCATION"
      invoice_status: "PENDING" | "PAID" | "EXPIRED" | "FAILED"
      media_context:
        | "PROBLEM_REPORT"
        | "PROOF_OF_ARRIVAL"
        | "BEFORE_WORK"
        | "WORK_IN_PROGRESS"
        | "COMPLETED_WORK"
        | "RECEIPT_PROOF"
      media_type: "IMAGE" | "VIDEO"
      payment_method_type:
        | "EWALLET"
        | "CARD"
        | "BANK_TRANSFER"
        | "RETAIL_OUTLET"
        | "QR_CODE"
      payout_status: "PROCESSING" | "COMPLETED" | "FAILED"
      price_applied_tier: "STANDARD_DAY" | "AFTER5_NIGHT"
      provider_status: "offline" | "online" | "busy" | "suspended"
      ticket_category: "DISPUTE" | "BILLING" | "TECHNICAL" | "OTHER"
      ticket_status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
      verification_status: "pending" | "verified" | "rejected"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "customer", "provider", "agency_admin"],
      booking_scheduling_type: ["ASAP", "SCHEDULED"],
      booking_status: [
        "finding_provider",
        "pending_acceptance",
        "confirmed",
        "on_the_way",
        "arrived",
        "in_progress",
        "payment_pending",
        "paid",
        "cancelled",
        "rejected",
        "expired",
        "completed",
      ],
      chat_message_type: ["TEXT", "IMAGE", "LOCATION"],
      invoice_status: ["PENDING", "PAID", "EXPIRED", "FAILED"],
      media_context: [
        "PROBLEM_REPORT",
        "PROOF_OF_ARRIVAL",
        "BEFORE_WORK",
        "WORK_IN_PROGRESS",
        "COMPLETED_WORK",
        "RECEIPT_PROOF",
      ],
      media_type: ["IMAGE", "VIDEO"],
      payment_method_type: [
        "EWALLET",
        "CARD",
        "BANK_TRANSFER",
        "RETAIL_OUTLET",
        "QR_CODE",
      ],
      payout_status: ["PROCESSING", "COMPLETED", "FAILED"],
      price_applied_tier: ["STANDARD_DAY", "AFTER5_NIGHT"],
      provider_status: ["offline", "online", "busy", "suspended"],
      ticket_category: ["DISPUTE", "BILLING", "TECHNICAL", "OTHER"],
      ticket_status: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const

