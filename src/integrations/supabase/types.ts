export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          id: string
          case_number: string
          title: string
          description: string
          priority: Database["public"]["Enums"]["case_priority"]
          status: Database["public"]["Enums"]["case_status"]
          client_id: string
          location_id: string
          current_assignee_id: string | null
          current_assignee_type: Database["public"]["Enums"]["assignee_type"] | null
          current_vendor_id: string | null
          due_at: string
          base_rate_inr: number
          total_rate_inr: number
          travel_allowance_inr: number
          bonus_inr: number
          tat_hours: number
          instructions: string | null
          created_at: string
          updated_at: string
          created_by: string
          updated_by: string
          status_updated_at: string
        }
        Insert: {
          id?: string
          case_number: string
          title: string
          description: string
          priority?: Database["public"]["Enums"]["case_priority"]
          status?: Database["public"]["Enums"]["case_status"]
          client_id: string
          location_id: string
          current_assignee_id?: string | null
          current_assignee_type?: Database["public"]["Enums"]["assignee_type"] | null
          current_vendor_id?: string | null
          due_at: string
          base_rate_inr: number
          total_rate_inr: number
          travel_allowance_inr?: number
          bonus_inr?: number
          tat_hours: number
          instructions?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
          updated_by: string
          status_updated_at?: string
        }
        Update: {
          id?: string
          case_number?: string
          title?: string
          description?: string
          priority?: Database["public"]["Enums"]["case_priority"]
          status?: Database["public"]["Enums"]["case_status"]
          client_id?: string
          location_id?: string
          current_assignee_id?: string | null
          current_assignee_type?: Database["public"]["Enums"]["assignee_type"] | null
          current_vendor_id?: string | null
          due_at?: string
          base_rate_inr?: number
          total_rate_inr?: number
          travel_allowance_inr?: number
          bonus_inr?: number
          tat_hours?: number
          instructions?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
          updated_by?: string
          status_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          }
        ]
      }
      locations: {
        Row: {
          id: string
          address_line: string
          city: string
          state: string
          pincode: string
          country: string
          lat: number | null
          lng: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          address_line: string
          city: string
          state: string
          pincode: string
          country?: string
          lat?: number | null
          lng?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          address_line?: string
          city?: string
          state?: string
          pincode?: string
          country?: string
          lat?: number | null
          lng?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          profile_id: string
          name: string
          contact_person: string
          phone: string
          email: string
          address: string
          city: string
          state: string
          pincode: string
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string
          updated_by: string
        }
        Insert: {
          id?: string
          profile_id: string
          name: string
          contact_person: string
          phone: string
          email: string
          address: string
          city: string
          state: string
          pincode: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by: string
          updated_by: string
        }
        Update: {
          id?: string
          profile_id?: string
          name?: string
          contact_person?: string
          phone?: string
          email?: string
          address?: string
          city?: string
          state?: string
          pincode?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      vendors: {
        Row: {
          id: string
          profile_id: string
          name: string
          contact_person: string
          phone: string
          email: string
          address: string
          city: string
          state: string
          pincode: string
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string
          updated_by: string
        }
        Insert: {
          id?: string
          profile_id: string
          name: string
          contact_person: string
          phone: string
          email: string
          address: string
          city: string
          state: string
          pincode: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by: string
          updated_by: string
        }
        Update: {
          id?: string
          profile_id?: string
          name?: string
          contact_person?: string
          phone?: string
          email?: string
          address?: string
          city?: string
          state?: string
          pincode?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      gig_partners: {
        Row: {
          id: string
          profile_id: string
          vendor_id: string | null
          coverage_pincodes: string[]
          max_daily_capacity: number
          current_capacity: number
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string
          updated_by: string
        }
        Insert: {
          id?: string
          profile_id: string
          vendor_id?: string | null
          coverage_pincodes: string[]
          max_daily_capacity: number
          current_capacity?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by: string
          updated_by: string
        }
        Update: {
          id?: string
          profile_id?: string
          vendor_id?: string | null
          coverage_pincodes?: string[]
          max_daily_capacity?: number
          current_capacity?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_partners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_partners_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          }
        ]
      }
      rate_cards: {
        Row: {
          id: string
          name: string
          pincode_tier: Database["public"]["Enums"]["pincode_tier"]
          completion_slab: Database["public"]["Enums"]["completion_slab"]
          base_rate_inr: number
          travel_allowance_inr: number
          bonus_inr: number
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string
          updated_by: string
        }
        Insert: {
          id?: string
          name: string
          pincode_tier: Database["public"]["Enums"]["pincode_tier"]
          completion_slab: Database["public"]["Enums"]["completion_slab"]
          base_rate_inr: number
          travel_allowance_inr?: number
          bonus_inr?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by: string
          updated_by: string
        }
        Update: {
          id?: string
          name?: string
          pincode_tier?: Database["public"]["Enums"]["pincode_tier"]
          completion_slab?: Database["public"]["Enums"]["completion_slab"]
          base_rate_inr?: number
          travel_allowance_inr?: number
          bonus_inr?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string
          updated_by?: string
        }
        Relationships: []
      }
      allocation_logs: {
        Row: {
          id: string
          case_id: string
          gig_partner_id: string
          allocation_type: Database["public"]["Enums"]["allocation_type"]
          wave_number: number
          decision: Database["public"]["Enums"]["allocation_decision"]
          reason: string | null
          quality_score: number | null
          capacity_score: number | null
          distance_score: number | null
          total_score: number | null
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          case_id: string
          gig_partner_id: string
          allocation_type: Database["public"]["Enums"]["allocation_type"]
          wave_number: number
          decision: Database["public"]["Enums"]["allocation_decision"]
          reason?: string | null
          quality_score?: number | null
          capacity_score?: number | null
          distance_score?: number | null
          total_score?: number | null
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          case_id?: string
          gig_partner_id?: string
          allocation_type?: Database["public"]["Enums"]["allocation_type"]
          wave_number?: number
          decision?: Database["public"]["Enums"]["allocation_decision"]
          reason?: string | null
          quality_score?: number | null
          capacity_score?: number | null
          distance_score?: number | null
          total_score?: number | null
          created_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_logs_gig_partner_id_fkey"
            columns: ["gig_partner_id"]
            isOneToOne: false
            referencedRelation: "gig_partners"
            referencedColumns: ["id"]
          }
        ]
      }
      submissions: {
        Row: {
          id: string
          case_id: string
          gig_partner_id: string
          submitted_at: string
          status: Database["public"]["Enums"]["submission_status"]
          answers: Json
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_id: string
          gig_partner_id: string
          submitted_at: string
          status?: Database["public"]["Enums"]["submission_status"]
          answers: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          gig_partner_id?: string
          submitted_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          answers?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_gig_partner_id_fkey"
            columns: ["gig_partner_id"]
            isOneToOne: false
            referencedRelation: "gig_partners"
            referencedColumns: ["id"]
          }
        ]
      }
      qc_reviews: {
        Row: {
          id: string
          submission_id: string
          reviewer_id: string
          result: Database["public"]["Enums"]["qc_result"]
          comments: string | null
          quality_score: number | null
          reviewed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          reviewer_id: string
          result: Database["public"]["Enums"]["qc_result"]
          comments?: string | null
          quality_score?: number | null
          reviewed_at: string
          created_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          reviewer_id?: string
          result?: Database["public"]["Enums"]["qc_result"]
          comments?: string | null
          quality_score?: number | null
          reviewed_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          }
        ]
      }
      payment_cycles: {
        Row: {
          id: string
          cycle_tag: string
          start_date: string
          end_date: string
          status: Database["public"]["Enums"]["payment_cycle_status"]
          total_amount_inr: number
          total_cases: number
          created_at: string
          updated_at: string
          created_by: string
          updated_by: string
        }
        Insert: {
          id?: string
          cycle_tag: string
          start_date: string
          end_date: string
          status?: Database["public"]["Enums"]["payment_cycle_status"]
          total_amount_inr?: number
          total_cases?: number
          created_at?: string
          updated_at?: string
          created_by: string
          updated_by: string
        }
        Update: {
          id?: string
          cycle_tag?: string
          start_date?: string
          end_date?: string
          status?: Database["public"]["Enums"]["payment_cycle_status"]
          total_amount_inr?: number
          total_cases?: number
          created_at?: string
          updated_at?: string
          created_by?: string
          updated_by?: string
        }
        Relationships: []
      }
      payment_lines: {
        Row: {
          id: string
          payment_cycle_id: string
          case_id: string
          gig_partner_id: string
          vendor_id: string | null
          assignment_type: Database["public"]["Enums"]["assignee_type"]
          base_rate_inr: number
          travel_allowance_inr: number
          bonus_inr: number
          adjustment_inr: number
          total_amount_inr: number
          status: Database["public"]["Enums"]["payment_status"]
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payment_cycle_id: string
          case_id: string
          gig_partner_id: string
          vendor_id?: string | null
          assignment_type: Database["public"]["Enums"]["assignee_type"]
          base_rate_inr: number
          travel_allowance_inr?: number
          bonus_inr?: number
          adjustment_inr?: number
          total_amount_inr: number
          status?: Database["public"]["Enums"]["payment_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          payment_cycle_id?: string
          case_id?: string
          gig_partner_id?: string
          vendor_id?: string | null
          assignment_type?: Database["public"]["Enums"]["assignee_type"]
          base_rate_inr?: number
          travel_allowance_inr?: number
          bonus_inr?: number
          adjustment_inr?: number
          total_amount_inr?: number
          status?: Database["public"]["Enums"]["payment_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_lines_payment_cycle_id_fkey"
            columns: ["payment_cycle_id"]
            isOneToOne: false
            referencedRelation: "payment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_lines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_templates: {
        Row: {
          id: string
          template_key: string
          name: string
          description: string
          channels: Database["public"]["Enums"]["notification_channel"][]
          subject_template: string
          body_template: string
          variables: string[]
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          template_key: string
          name: string
          description: string
          channels: Database["public"]["Enums"]["notification_channel"][]
          subject_template: string
          body_template: string
          variables: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          template_key?: string
          name?: string
          description?: string
          channels?: Database["public"]["Enums"]["notification_channel"][]
          subject_template?: string
          body_template?: string
          variables?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          template_id: string
          recipient_id: string
          recipient_type: Database["public"]["Enums"]["recipient_type"]
          channel: Database["public"]["Enums"]["notification_channel"]
          subject: string
          body: string
          status: Database["public"]["Enums"]["notification_status"]
          sent_at: string | null
          delivered_at: string | null
          error_message: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          recipient_id: string
          recipient_type: Database["public"]["Enums"]["recipient_type"]
          channel: Database["public"]["Enums"]["notification_channel"]
          subject: string
          body: string
          status?: Database["public"]["Enums"]["notification_status"]
          sent_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          recipient_id?: string
          recipient_type?: Database["public"]["Enums"]["recipient_type"]
          channel?: Database["public"]["Enums"]["notification_channel"]
          subject?: string
          body?: string
          status?: Database["public"]["Enums"]["notification_status"]
          sent_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          id: string
          config_key: string
          config_value: Json
          description: string | null
          created_at: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          id?: string
          config_key: string
          config_value: Json
          description?: string | null
          created_at?: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          id?: string
          config_key?: string
          config_value?: Json
          description?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_user: {
        Args: {
          _target_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      auto_allocate_case: {
        Args: {
          p_case_id: string
        }
        Returns: string
      }
      calculate_performance_metrics: {
        Args: {
          p_gig_partner_id: string
        }
        Returns: Json
      }
      get_eligible_gig_partners: {
        Args: {
          p_case_id: string
        }
        Returns: Json
      }
      reallocate_case: {
        Args: {
          p_case_id: string
        }
        Returns: string
      }
      score_gig_partner: {
        Args: {
          p_gig_partner_id: string
          p_case_id: string
        }
        Returns: number
      }
      update_gig_capacity: {
        Args: {
          p_gig_partner_id: string
          p_capacity_change: number
        }
        Returns: void
      }
    }
    Enums: {
      app_role: "super_admin" | "ops_team" | "vendor_team" | "qc_team" | "vendor" | "gig_worker" | "client"
      assignee_type: "gig" | "vendor"
      case_priority: "low" | "medium" | "high" | "urgent"
      case_status: "new" | "allocated" | "pending_allocation" | "accepted" | "rejected" | "in_progress" | "submitted" | "qc_passed" | "qc_rejected" | "qc_rework" | "completed" | "reported" | "in_payment_cycle" | "payment_complete" | "cancelled"
      completion_slab: "within_24h" | "within_48h" | "within_72h" | "within_1w"
      notification_channel: "email" | "sms" | "whatsapp" | "push"
      notification_status: "pending" | "sent" | "delivered" | "failed" | "bounced"
      payment_cycle_status: "draft" | "processing" | "completed" | "cancelled"
      payment_method: "bank_transfer" | "upi" | "wallet"
      payment_status: "pending" | "approved" | "paid" | "cancelled"
      pincode_tier: "tier1" | "tier2" | "tier3"
      qc_result: "pass" | "reject" | "rework"
      recipient_type: "gig_worker" | "vendor" | "client" | "ops_team" | "qc_team"
      submission_status: "pending" | "in_review" | "passed" | "rejected" | "rework"
      allocation_type: "auto" | "manual" | "reallocation"
      allocation_decision: "allocated" | "rejected" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
