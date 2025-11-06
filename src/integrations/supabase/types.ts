export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      allocation_config: {
        Row: {
          config_key: string
          config_value: Json
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
          updated_by: string
        }
        Insert: {
          config_key: string
          config_value: Json
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      allocation_logs: {
        Row: {
          acceptance_deadline: string
          acceptance_window_minutes: number
          accepted_at: string | null
          allocated_at: string
          candidate_id: string
          candidate_type: Database["public"]["Enums"]["assignment_type"]
          case_id: string
          created_at: string
          created_by: string
          decision: Database["public"]["Enums"]["allocation_decision"]
          decision_at: string | null
          final_score: number | null
          id: string
          reallocated_at: string | null
          reallocated_by: string | null
          reallocation_reason: string | null
          score_snapshot: Json
          vendor_id: string | null
          wave_number: number
        }
        Insert: {
          acceptance_deadline: string
          acceptance_window_minutes?: number
          accepted_at?: string | null
          allocated_at?: string
          candidate_id: string
          candidate_type: Database["public"]["Enums"]["assignment_type"]
          case_id: string
          created_at?: string
          created_by: string
          decision?: Database["public"]["Enums"]["allocation_decision"]
          decision_at?: string | null
          final_score?: number | null
          id?: string
          reallocated_at?: string | null
          reallocated_by?: string | null
          reallocation_reason?: string | null
          score_snapshot?: Json
          vendor_id?: string | null
          wave_number?: number
        }
        Update: {
          acceptance_deadline?: string
          acceptance_window_minutes?: number
          accepted_at?: string | null
          allocated_at?: string
          candidate_id?: string
          candidate_type?: Database["public"]["Enums"]["assignment_type"]
          case_id?: string
          created_at?: string
          created_by?: string
          decision?: Database["public"]["Enums"]["allocation_decision"]
          decision_at?: string | null
          final_score?: number | null
          id?: string
          reallocated_at?: string | null
          reallocated_by?: string | null
          reallocation_reason?: string | null
          score_snapshot?: Json
          vendor_id?: string | null
          wave_number?: number
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
            foreignKeyName: "allocation_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          case_id: string | null
          changed_fields: string[] | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          case_id?: string | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          case_id?: string | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_tracking: {
        Row: {
          cases_accepted: number
          cases_allocated: number
          cases_completed: number
          cases_in_progress: number
          cases_submitted: number
          created_at: string
          current_capacity_available: number
          date: string
          gig_partner_id: string
          id: string
          initial_capacity_available: number
          is_active: boolean
          last_capacity_consumed_at: string | null
          last_capacity_freed_at: string | null
          last_reset_at: string
          max_daily_capacity: number
          reset_count: number
          updated_at: string
        }
        Insert: {
          cases_accepted?: number
          cases_allocated?: number
          cases_completed?: number
          cases_in_progress?: number
          cases_submitted?: number
          created_at?: string
          current_capacity_available: number
          date: string
          gig_partner_id: string
          id?: string
          initial_capacity_available: number
          is_active?: boolean
          last_capacity_consumed_at?: string | null
          last_capacity_freed_at?: string | null
          last_reset_at?: string
          max_daily_capacity: number
          reset_count?: number
          updated_at?: string
        }
        Update: {
          cases_accepted?: number
          cases_allocated?: number
          cases_completed?: number
          cases_in_progress?: number
          cases_submitted?: number
          created_at?: string
          current_capacity_available?: number
          date?: string
          gig_partner_id?: string
          id?: string
          initial_capacity_available?: number
          is_active?: boolean
          last_capacity_consumed_at?: string | null
          last_capacity_freed_at?: string | null
          last_reset_at?: string
          max_daily_capacity?: number
          reset_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_tracking_gig_partner_id_fkey"
            columns: ["gig_partner_id"]
            isOneToOne: false
            referencedRelation: "gig_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      case_attachments: {
        Row: {
          case_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_processed: boolean
          mime_type: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          case_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_processed?: boolean
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          case_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_processed?: boolean
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_attachments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          base_rate_inr: number
          bonus_inr: number
          candidate_name: string
          case_number: string
          client_case_id: string
          client_id: string
          company_name: string | null
          contract_type: string
          created_at: string
          created_by: string
          current_assignee_id: string | null
          current_assignee_type:
            | Database["public"]["Enums"]["assignment_type"]
            | null
          current_vendor_id: string | null
          description: string
          due_at: string
          id: string
          instructions: string | null
          last_updated_by: string | null
          location_id: string
          metadata: Json
          penalty_inr: number
          phone_primary: string
          phone_secondary: string | null
          priority: Database["public"]["Enums"]["case_priority"]
          QC_Response: Database["public"]["Enums"]["QC_Response"] | null
          rate_adjustments: Json
          source: Database["public"]["Enums"]["case_source"]
          status: Database["public"]["Enums"]["case_status"] | null
          status_updated_at: string
          tat_hours: number
          title: string
          total_payout_inr: number
          total_rate_inr: number
          travel_allowance_inr: number
          updated_at: string
          vendor_tat_start_date: string
          visible_to_gig: boolean
        }
        Insert: {
          base_rate_inr?: number
          bonus_inr?: number
          candidate_name: string
          case_number: string
          client_case_id: string
          client_id: string
          company_name?: string | null
          contract_type: string
          created_at?: string
          created_by: string
          current_assignee_id?: string | null
          current_assignee_type?:
            | Database["public"]["Enums"]["assignment_type"]
            | null
          current_vendor_id?: string | null
          description: string
          due_at: string
          id?: string
          instructions?: string | null
          last_updated_by?: string | null
          location_id: string
          metadata?: Json
          penalty_inr?: number
          phone_primary: string
          phone_secondary?: string | null
          priority?: Database["public"]["Enums"]["case_priority"]
          QC_Response?: Database["public"]["Enums"]["QC_Response"] | null
          rate_adjustments?: Json
          source?: Database["public"]["Enums"]["case_source"]
          status?: Database["public"]["Enums"]["case_status"] | null
          status_updated_at?: string
          tat_hours: number
          title: string
          total_payout_inr?: number
          total_rate_inr?: number
          travel_allowance_inr?: number
          updated_at?: string
          vendor_tat_start_date: string
          visible_to_gig?: boolean
        }
        Update: {
          base_rate_inr?: number
          bonus_inr?: number
          candidate_name?: string
          case_number?: string
          client_case_id?: string
          client_id?: string
          company_name?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string
          current_assignee_id?: string | null
          current_assignee_type?:
            | Database["public"]["Enums"]["assignment_type"]
            | null
          current_vendor_id?: string | null
          description?: string
          due_at?: string
          id?: string
          instructions?: string | null
          last_updated_by?: string | null
          location_id?: string
          metadata?: Json
          penalty_inr?: number
          phone_primary?: string
          phone_secondary?: string | null
          priority?: Database["public"]["Enums"]["case_priority"]
          QC_Response?: Database["public"]["Enums"]["QC_Response"] | null
          rate_adjustments?: Json
          source?: Database["public"]["Enums"]["case_source"]
          status?: Database["public"]["Enums"]["case_status"] | null
          status_updated_at?: string
          tat_hours?: number
          title?: string
          total_payout_inr?: number
          total_rate_inr?: number
          travel_allowance_inr?: number
          updated_at?: string
          vendor_tat_start_date?: string
          visible_to_gig?: boolean
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
            foreignKeyName: "cases_contract_type_fkey"
            columns: ["contract_type"]
            isOneToOne: false
            referencedRelation: "contract_type_config"
            referencedColumns: ["type_key"]
          },
          {
            foreignKeyName: "cases_current_vendor_id_fkey"
            columns: ["current_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contracts: {
        Row: {
          bonuses: Json
          client_id: string
          contract_type: string
          created_at: string
          created_by: string
          escalation_contacts: Json
          escalation_rules: Json
          id: string
          is_active: boolean
          penalties: Json
          report_delivery_config: Json
          report_delivery_method: string
          terms: Json
          tier_1_rate_card_id: string | null
          tier_2_rate_card_id: string | null
          tier_3_rate_card_id: string | null
          tier1_base_payout_inr: number
          tier1_revenue_inr: number
          tier1_tat_days: number
          tier2_base_payout_inr: number
          tier2_revenue_inr: number
          tier2_tat_days: number
          tier3_base_payout_inr: number
          tier3_revenue_inr: number
          tier3_tat_days: number
          updated_at: string
          working_hours_end: string
          working_hours_start: string
        }
        Insert: {
          bonuses?: Json
          client_id: string
          contract_type: string
          created_at?: string
          created_by: string
          escalation_contacts?: Json
          escalation_rules?: Json
          id?: string
          is_active?: boolean
          penalties?: Json
          report_delivery_config?: Json
          report_delivery_method?: string
          terms?: Json
          tier_1_rate_card_id?: string | null
          tier_2_rate_card_id?: string | null
          tier_3_rate_card_id?: string | null
          tier1_base_payout_inr: number
          tier1_revenue_inr: number
          tier1_tat_days: number
          tier2_base_payout_inr: number
          tier2_revenue_inr: number
          tier2_tat_days: number
          tier3_base_payout_inr: number
          tier3_revenue_inr: number
          tier3_tat_days: number
          updated_at?: string
          working_hours_end: string
          working_hours_start: string
        }
        Update: {
          bonuses?: Json
          client_id?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          escalation_contacts?: Json
          escalation_rules?: Json
          id?: string
          is_active?: boolean
          penalties?: Json
          report_delivery_config?: Json
          report_delivery_method?: string
          terms?: Json
          tier_1_rate_card_id?: string | null
          tier_2_rate_card_id?: string | null
          tier_3_rate_card_id?: string | null
          tier1_base_payout_inr?: number
          tier1_revenue_inr?: number
          tier1_tat_days?: number
          tier2_base_payout_inr?: number
          tier2_revenue_inr?: number
          tier2_tat_days?: number
          tier3_base_payout_inr?: number
          tier3_revenue_inr?: number
          tier3_tat_days?: number
          updated_at?: string
          working_hours_end?: string
          working_hours_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          allowed_sender_domains: string[] | null
          city: string | null
          contact_person: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_terms: Json | null
          country: string
          created_at: string
          created_by: string
          default_tats: Json | null
          email: string
          escalation_contacts: Json | null
          id: string
          ingestion_api_key: string | null
          ingestion_drive_folder_id: string | null
          ingestion_email: string | null
          is_active: boolean
          name: string
          phone: string | null
          pincode: string | null
          rate_card_policy: string | null
          report_delivery_config: Json | null
          report_delivery_method: string
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allowed_sender_domains?: string[] | null
          city?: string | null
          contact_person?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_terms?: Json | null
          country?: string
          created_at?: string
          created_by: string
          default_tats?: Json | null
          email: string
          escalation_contacts?: Json | null
          id?: string
          ingestion_api_key?: string | null
          ingestion_drive_folder_id?: string | null
          ingestion_email?: string | null
          is_active?: boolean
          name: string
          phone?: string | null
          pincode?: string | null
          rate_card_policy?: string | null
          report_delivery_config?: Json | null
          report_delivery_method?: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allowed_sender_domains?: string[] | null
          city?: string | null
          contact_person?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_terms?: Json | null
          country?: string
          created_at?: string
          created_by?: string
          default_tats?: Json | null
          email?: string
          escalation_contacts?: Json | null
          id?: string
          ingestion_api_key?: string | null
          ingestion_drive_folder_id?: string | null
          ingestion_email?: string | null
          is_active?: boolean
          name?: string
          phone?: string | null
          pincode?: string | null
          rate_card_policy?: string | null
          report_delivery_config?: Json | null
          report_delivery_method?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      communication_preferences: {
        Row: {
          acceptance_reminders: boolean
          allocation_notifications: boolean
          created_at: string
          email_enabled: boolean
          id: string
          ivr_enabled: boolean
          payment_notifications: boolean
          preferred_language: string
          preferred_region: string
          push_enabled: boolean
          qc_results: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sms_enabled: boolean
          system_alerts: boolean
          timezone: string
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          acceptance_reminders?: boolean
          allocation_notifications?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          ivr_enabled?: boolean
          payment_notifications?: boolean
          preferred_language?: string
          preferred_region?: string
          push_enabled?: boolean
          qc_results?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          system_alerts?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          acceptance_reminders?: boolean
          allocation_notifications?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          ivr_enabled?: boolean
          payment_notifications?: boolean
          preferred_language?: string
          preferred_region?: string
          push_enabled?: boolean
          qc_results?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          system_alerts?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      contract_type_config: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          sort_order: number
          type_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          sort_order?: number
          type_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          type_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string | null
          gig_worker_id: string
          id: string
          is_active: boolean | null
          platform: string
          token: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gig_worker_id: string
          id?: string
          is_active?: boolean | null
          platform: string
          token: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gig_worker_id?: string
          id?: string
          is_active?: boolean | null
          platform?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_gig_worker_id_fkey"
            columns: ["gig_worker_id"]
            isOneToOne: false
            referencedRelation: "gig_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      email_intake_logs: {
        Row: {
          attachments: Json
          case_id: string | null
          client_id: string | null
          created_at: string
          email_id: string
          id: string
          is_trusted_sender: boolean
          message_id: string | null
          parsed_data: Json
          parsing_errors: string[] | null
          processed_at: string | null
          received_at: string
          recipient_email: string
          sender_domain: string
          sender_email: string
          status: Database["public"]["Enums"]["email_intake_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          email_id: string
          id?: string
          is_trusted_sender?: boolean
          message_id?: string | null
          parsed_data?: Json
          parsing_errors?: string[] | null
          processed_at?: string | null
          received_at: string
          recipient_email: string
          sender_domain: string
          sender_email: string
          status?: Database["public"]["Enums"]["email_intake_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          email_id?: string
          id?: string
          is_trusted_sender?: boolean
          message_id?: string | null
          parsed_data?: Json
          parsing_errors?: string[] | null
          processed_at?: string | null
          received_at?: string
          recipient_email?: string
          sender_domain?: string
          sender_email?: string
          status?: Database["public"]["Enums"]["email_intake_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_intake_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_intake_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_reports: {
        Row: {
          created_at: string
          created_by: string
          file_format: string | null
          file_size: number | null
          file_url: string | null
          generated_at: string | null
          id: string
          report_data: Json
          report_period_end: string
          report_period_start: string
          report_type: string
          status: string
          summary_data: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          file_format?: string | null
          file_size?: number | null
          file_url?: string | null
          generated_at?: string | null
          id?: string
          report_data?: Json
          report_period_end: string
          report_period_start: string
          report_type: string
          status?: string
          summary_data?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          file_format?: string | null
          file_size?: number | null
          file_url?: string | null
          generated_at?: string | null
          id?: string
          report_data?: Json
          report_period_end?: string
          report_period_start?: string
          report_type?: string
          status?: string
          summary_data?: Json
        }
        Relationships: []
      }
      form_field_drafts: {
        Row: {
          case_id: string
          created_at: string | null
          field_key: string
          field_value: Json | null
          gig_partner_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          case_id: string
          created_at?: string | null
          field_key: string
          field_value?: Json | null
          gig_partner_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string | null
          field_key?: string
          field_value?: Json | null
          gig_partner_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_field_drafts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_field_drafts_gig_partner_id_fkey"
            columns: ["gig_partner_id"]
            isOneToOne: false
            referencedRelation: "gig_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          allowed_file_types: string[] | null
          created_at: string
          depends_on_field_id: string | null
          depends_on_value: string | null
          field_config: Json
          field_key: string
          field_order: number
          field_title: string
          field_type: Database["public"]["Enums"]["form_field_type"]
          id: string
          max_file_size_mb: number | null
          max_files: number | null
          template_id: string
          updated_at: string
          validation_type: Database["public"]["Enums"]["form_field_validation"]
        }
        Insert: {
          allowed_file_types?: string[] | null
          created_at?: string
          depends_on_field_id?: string | null
          depends_on_value?: string | null
          field_config?: Json
          field_key: string
          field_order?: number
          field_title: string
          field_type: Database["public"]["Enums"]["form_field_type"]
          id?: string
          max_file_size_mb?: number | null
          max_files?: number | null
          template_id: string
          updated_at?: string
          validation_type?: Database["public"]["Enums"]["form_field_validation"]
        }
        Update: {
          allowed_file_types?: string[] | null
          created_at?: string
          depends_on_field_id?: string | null
          depends_on_value?: string | null
          field_config?: Json
          field_key?: string
          field_order?: number
          field_title?: string
          field_type?: Database["public"]["Enums"]["form_field_type"]
          id?: string
          max_file_size_mb?: number | null
          max_files?: number | null
          template_id?: string
          updated_at?: string
          validation_type?: Database["public"]["Enums"]["form_field_validation"]
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_depends_on_field_id_fkey"
            columns: ["depends_on_field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submission_files: {
        Row: {
          field_id: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string
          submission_id: string
          uploaded_at: string
        }
        Insert: {
          field_id: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type: string
          submission_id: string
          uploaded_at?: string
        }
        Update: {
          field_id?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string
          submission_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submission_files_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          case_id: string
          created_at: string
          gig_partner_id: string
          id: string
          status: string
          submission_data: Json
          submitted_at: string
          template_id: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          gig_partner_id: string
          id?: string
          status?: string
          submission_data?: Json
          submitted_at?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          gig_partner_id?: string
          id?: string
          status?: string
          submission_data?: Json
          submitted_at?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_gig_partner_id_fkey"
            columns: ["gig_partner_id"]
            isOneToOne: false
            referencedRelation: "gig_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          contract_type_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          template_name: string
          template_version: number
          updated_at: string
        }
        Insert: {
          contract_type_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          template_name: string
          template_version?: number
          updated_at?: string
        }
        Update: {
          contract_type_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          template_name?: string
          template_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "contract_type_config"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_partners: {
        Row: {
          acceptance_rate: number
          active_cases_count: number
          address: string | null
          alternate_phone: string | null
          capacity_available: number
          city: string | null
          completion_rate: number
          country: string
          coverage_pincodes: string[]
          created_at: string
          created_by: string
          device_info: Json | null
          id: string
          is_active: boolean
          is_available: boolean
          is_direct_gig: boolean
          last_assignment_at: string | null
          last_capacity_reset: string
          last_seen_at: string | null
          max_daily_capacity: number
          ontime_completion_rate: number
          phone: string | null
          pincode: string | null
          profile_id: string
          qc_pass_count: number
          quality_score: number
          state: string | null
          total_cases_completed: number
          updated_at: string
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          acceptance_rate?: number
          active_cases_count?: number
          address?: string | null
          alternate_phone?: string | null
          capacity_available?: number
          city?: string | null
          completion_rate?: number
          country?: string
          coverage_pincodes?: string[]
          created_at?: string
          created_by: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_direct_gig?: boolean
          last_assignment_at?: string | null
          last_capacity_reset?: string
          last_seen_at?: string | null
          max_daily_capacity?: number
          ontime_completion_rate?: number
          phone?: string | null
          pincode?: string | null
          profile_id: string
          qc_pass_count?: number
          quality_score?: number
          state?: string | null
          total_cases_completed?: number
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          acceptance_rate?: number
          active_cases_count?: number
          address?: string | null
          alternate_phone?: string | null
          capacity_available?: number
          city?: string | null
          completion_rate?: number
          country?: string
          coverage_pincodes?: string[]
          created_at?: string
          created_by?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_direct_gig?: boolean
          last_assignment_at?: string | null
          last_capacity_reset?: string
          last_seen_at?: string | null
          max_daily_capacity?: number
          ontime_completion_rate?: number
          phone?: string | null
          pincode?: string | null
          profile_id?: string
          qc_pass_count?: number
          quality_score?: number
          state?: string | null
          total_cases_completed?: number
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_partners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_partners_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line: string
          city: string
          country: string
          created_at: string
          geocoded_at: string | null
          geocoding_accuracy: string | null
          id: string
          is_verified: boolean
          lat: number | null
          lng: number | null
          location_url: string | null
          pincode: string
          pincode_tier: Database["public"]["Enums"]["pincode_tier"]
          state: string
          updated_at: string
        }
        Insert: {
          address_line: string
          city: string
          country?: string
          created_at?: string
          geocoded_at?: string | null
          geocoding_accuracy?: string | null
          id?: string
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          location_url?: string | null
          pincode: string
          pincode_tier: Database["public"]["Enums"]["pincode_tier"]
          state: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          city?: string
          country?: string
          created_at?: string
          geocoded_at?: string | null
          geocoding_accuracy?: string | null
          id?: string
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          location_url?: string | null
          pincode?: string
          pincode_tier?: Database["public"]["Enums"]["pincode_tier"]
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          case_allocated: boolean | null
          case_timeout: boolean | null
          created_at: string | null
          general_notifications: boolean | null
          gig_worker_id: string
          id: string
          qc_rework: boolean | null
          updated_at: string | null
        }
        Insert: {
          case_allocated?: boolean | null
          case_timeout?: boolean | null
          created_at?: string | null
          general_notifications?: boolean | null
          gig_worker_id: string
          id?: string
          qc_rework?: boolean | null
          updated_at?: string | null
        }
        Update: {
          case_allocated?: boolean | null
          case_timeout?: boolean | null
          created_at?: string | null
          general_notifications?: boolean | null
          gig_worker_id?: string
          id?: string
          qc_rework?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_gig_worker_id_fkey"
            columns: ["gig_worker_id"]
            isOneToOne: true
            referencedRelation: "gig_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_template: string
          channels: Database["public"]["Enums"]["notification_channel"][]
          created_at: string
          created_by: string
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean
          language: string
          priority: Database["public"]["Enums"]["notification_priority"]
          region: string
          subject_template: string
          template_name: string
          template_type: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body_template: string
          channels?: Database["public"]["Enums"]["notification_channel"][]
          created_at?: string
          created_by: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          language?: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          region?: string
          subject_template: string
          template_name: string
          template_type: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body_template?: string
          channels?: Database["public"]["Enums"]["notification_channel"][]
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          language?: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          region?: string
          subject_template?: string
          template_name?: string
          template_type?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          case_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_response: Json
          external_id: string | null
          failure_reason: string | null
          id: string
          max_retries: number
          priority: Database["public"]["Enums"]["notification_priority"]
          recipient_contact: string
          recipient_id: string
          recipient_type: string
          related_entity_id: string | null
          related_entity_type: string | null
          retry_count: number
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
          template_id: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          case_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_response?: Json
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          max_retries?: number
          priority?: Database["public"]["Enums"]["notification_priority"]
          recipient_contact: string
          recipient_id: string
          recipient_type: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          retry_count?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject: string
          template_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          case_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_response?: Json
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          max_retries?: number
          priority?: Database["public"]["Enums"]["notification_priority"]
          recipient_contact?: string
          recipient_id?: string
          recipient_type?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          retry_count?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string
          template_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      password_setup_tokens: {
        Row: {
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          is_used: boolean
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email: string
          expires_at: string
          id?: string
          is_used?: boolean
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_adjustments: {
        Row: {
          adjustment_reason: string
          adjustment_type: string
          amount_inr: number
          approved_at: string
          approved_by: string
          case_id: string | null
          created_at: string
          created_by: string
          id: string
          payment_line_id: string
          reference_document: string | null
        }
        Insert: {
          adjustment_reason: string
          adjustment_type: string
          amount_inr: number
          approved_at?: string
          approved_by: string
          case_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          payment_line_id: string
          reference_document?: string | null
        }
        Update: {
          adjustment_reason?: string
          adjustment_type?: string
          amount_inr?: number
          approved_at?: string
          approved_by?: string
          case_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          payment_line_id?: string
          reference_document?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_adjustments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_adjustments_payment_line_id_fkey"
            columns: ["payment_line_id"]
            isOneToOne: false
            referencedRelation: "payment_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_config: {
        Row: {
          config_key: string
          config_value: Json
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
          updated_by: string
        }
        Insert: {
          config_key: string
          config_value: Json
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      payment_cycles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calculated_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          cycle_end_date: string
          cycle_start_date: string
          cycle_tag: string
          id: string
          net_amount: number
          processing_notes: string | null
          processing_started_at: string | null
          status: Database["public"]["Enums"]["payment_cycle_status"]
          total_adjustments: number
          total_amount: number
          total_cases: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          cycle_end_date: string
          cycle_start_date: string
          cycle_tag: string
          id?: string
          net_amount?: number
          processing_notes?: string | null
          processing_started_at?: string | null
          status?: Database["public"]["Enums"]["payment_cycle_status"]
          total_adjustments?: number
          total_amount?: number
          total_cases?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          cycle_end_date?: string
          cycle_start_date?: string
          cycle_tag?: string
          id?: string
          net_amount?: number
          processing_notes?: string | null
          processing_started_at?: string | null
          status?: Database["public"]["Enums"]["payment_cycle_status"]
          total_adjustments?: number
          total_amount?: number
          total_cases?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_lines: {
        Row: {
          bank_account: string | null
          bank_ifsc: string | null
          base_rate_inr: number
          beneficiary_id: string
          beneficiary_name: string
          beneficiary_type: Database["public"]["Enums"]["beneficiary_type"]
          bonus_inr: number
          case_id: string
          created_at: string
          disbursed_at: string | null
          failure_reason: string | null
          id: string
          ops_override_delta: number
          payment_cycle_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["payment_status"]
          total_inr: number
          transaction_id: string | null
          travel_allowance_inr: number
          updated_at: string
          upi_id: string | null
          wallet_id: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_ifsc?: string | null
          base_rate_inr?: number
          beneficiary_id: string
          beneficiary_name: string
          beneficiary_type: Database["public"]["Enums"]["beneficiary_type"]
          bonus_inr?: number
          case_id: string
          created_at?: string
          disbursed_at?: string | null
          failure_reason?: string | null
          id?: string
          ops_override_delta?: number
          payment_cycle_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          total_inr?: number
          transaction_id?: string | null
          travel_allowance_inr?: number
          updated_at?: string
          upi_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_ifsc?: string | null
          base_rate_inr?: number
          beneficiary_id?: string
          beneficiary_name?: string
          beneficiary_type?: Database["public"]["Enums"]["beneficiary_type"]
          bonus_inr?: number
          case_id?: string
          created_at?: string
          disbursed_at?: string | null
          failure_reason?: string | null
          id?: string
          ops_override_delta?: number
          payment_cycle_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          total_inr?: number
          transaction_id?: string | null
          travel_allowance_inr?: number
          updated_at?: string
          upi_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_lines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_lines_payment_cycle_id_fkey"
            columns: ["payment_cycle_id"]
            isOneToOne: false
            referencedRelation: "payment_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          acceptance_rate: number
          avg_acceptance_time_minutes: number | null
          avg_completion_time_hours: number | null
          completion_rate: number
          created_at: string
          gig_partner_id: string
          id: string
          last_updated_at: string
          ontime_completion_rate: number
          period_end: string
          period_start: string
          quality_score: number
          total_cases_accepted: number
          total_cases_assigned: number
          total_cases_completed: number
          total_cases_on_time: number
          total_cases_qc_passed: number
          total_cases_qc_rejected: number
          vendor_id: string | null
        }
        Insert: {
          acceptance_rate?: number
          avg_acceptance_time_minutes?: number | null
          avg_completion_time_hours?: number | null
          completion_rate?: number
          created_at?: string
          gig_partner_id: string
          id?: string
          last_updated_at?: string
          ontime_completion_rate?: number
          period_end: string
          period_start: string
          quality_score?: number
          total_cases_accepted?: number
          total_cases_assigned?: number
          total_cases_completed?: number
          total_cases_on_time?: number
          total_cases_qc_passed?: number
          total_cases_qc_rejected?: number
          vendor_id?: string | null
        }
        Update: {
          acceptance_rate?: number
          avg_acceptance_time_minutes?: number | null
          avg_completion_time_hours?: number | null
          completion_rate?: number
          created_at?: string
          gig_partner_id?: string
          id?: string
          last_updated_at?: string
          ontime_completion_rate?: number
          period_end?: string
          period_start?: string
          quality_score?: number
          total_cases_accepted?: number
          total_cases_assigned?: number
          total_cases_completed?: number
          total_cases_on_time?: number
          total_cases_qc_passed?: number
          total_cases_qc_rejected?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_metrics_gig_partner_id_fkey"
            columns: ["gig_partner_id"]
            isOneToOne: false
            referencedRelation: "gig_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_metrics_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      pincode_tiers: {
        Row: {
          city: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          pincode: string
          region: string | null
          state: string | null
          tier: Database["public"]["Enums"]["pincode_tier"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          pincode: string
          region?: string | null
          state?: string | null
          tier: Database["public"]["Enums"]["pincode_tier"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          pincode?: string
          region?: string | null
          state?: string | null
          tier?: Database["public"]["Enums"]["pincode_tier"]
          updated_at?: string
        }
        Relationships: []
      }
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: []
      }
      qc_quality_standards: {
        Row: {
          created_at: string
          created_by: string
          criteria_description: string
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean
          max_score: number
          min_score: number
          standard_name: string
          standard_type: string
          updated_at: string
          validation_rules: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          criteria_description: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          max_score?: number
          min_score?: number
          standard_name: string
          standard_type: string
          updated_at?: string
          validation_rules?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          criteria_description?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          max_score?: number
          min_score?: number
          standard_name?: string
          standard_type?: string
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: []
      }
      qc_reason_codes: {
        Row: {
          code: Database["public"]["Enums"]["qc_reason_code"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          requires_comment: boolean
          severity_level: number
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["qc_reason_code"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_comment?: boolean
          severity_level?: number
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["qc_reason_code"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_comment?: boolean
          severity_level?: number
          updated_at?: string
        }
        Relationships: []
      }
      qc_reviews: {
        Row: {
          case_id: string
          comments: string | null
          created_at: string
          data_completeness_score: number | null
          form_submission_id: string | null
          id: string
          improvement_suggestions: string | null
          issues_found: string[] | null
          location_accuracy_score: number | null
          overall_score: number | null
          photo_quality_score: number | null
          reason_code: Database["public"]["Enums"]["qc_reason_code"] | null
          result: Database["public"]["Enums"]["qc_result"]
          reviewed_at: string
          reviewer_id: string
          rework_deadline: string | null
          rework_instructions: string | null
          submission_id: string | null
          updated_at: string
        }
        Insert: {
          case_id: string
          comments?: string | null
          created_at?: string
          data_completeness_score?: number | null
          form_submission_id?: string | null
          id?: string
          improvement_suggestions?: string | null
          issues_found?: string[] | null
          location_accuracy_score?: number | null
          overall_score?: number | null
          photo_quality_score?: number | null
          reason_code?: Database["public"]["Enums"]["qc_reason_code"] | null
          result: Database["public"]["Enums"]["qc_result"]
          reviewed_at?: string
          reviewer_id: string
          rework_deadline?: string | null
          rework_instructions?: string | null
          submission_id?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          comments?: string | null
          created_at?: string
          data_completeness_score?: number | null
          form_submission_id?: string | null
          id?: string
          improvement_suggestions?: string | null
          issues_found?: string[] | null
          location_accuracy_score?: number | null
          overall_score?: number | null
          photo_quality_score?: number | null
          reason_code?: Database["public"]["Enums"]["qc_reason_code"] | null
          result?: Database["public"]["Enums"]["qc_result"]
          reviewed_at?: string
          reviewer_id?: string
          rework_deadline?: string | null
          rework_instructions?: string | null
          submission_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reviews_form_submission_id_fkey"
            columns: ["form_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_workflow: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          auto_assigned: boolean
          case_id: string
          completed_at: string | null
          created_at: string
          current_stage: string
          external_notes: string | null
          id: string
          internal_notes: string | null
          is_active: boolean
          priority: number
          sla_deadline: string | null
          started_at: string | null
          submission_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          auto_assigned?: boolean
          case_id: string
          completed_at?: string | null
          created_at?: string
          current_stage: string
          external_notes?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          priority?: number
          sla_deadline?: string | null
          started_at?: string | null
          submission_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          auto_assigned?: boolean
          case_id?: string
          completed_at?: string | null
          created_at?: string
          current_stage?: string
          external_notes?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          priority?: number
          sla_deadline?: string | null
          started_at?: string | null
          submission_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_workflow_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_workflow_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_photos: {
        Row: {
          created_at: string
          exif_data: Json
          file_name: string
          file_size: number | null
          id: string
          is_gps_valid: boolean | null
          is_photo_quality_good: boolean | null
          is_processed: boolean
          is_timestamp_valid: boolean | null
          mime_type: string
          photo_address: string | null
          photo_lat: number | null
          photo_lng: number | null
          photo_url: string
          processing_errors: string[] | null
          submission_id: string
          taken_at: string | null
          thumbnail_url: string | null
          uploaded_at: string
          validation_notes: string | null
        }
        Insert: {
          created_at?: string
          exif_data?: Json
          file_name: string
          file_size?: number | null
          id?: string
          is_gps_valid?: boolean | null
          is_photo_quality_good?: boolean | null
          is_processed?: boolean
          is_timestamp_valid?: boolean | null
          mime_type: string
          photo_address?: string | null
          photo_lat?: number | null
          photo_lng?: number | null
          photo_url: string
          processing_errors?: string[] | null
          submission_id: string
          taken_at?: string | null
          thumbnail_url?: string | null
          uploaded_at?: string
          validation_notes?: string | null
        }
        Update: {
          created_at?: string
          exif_data?: Json
          file_name?: string
          file_size?: number | null
          id?: string
          is_gps_valid?: boolean | null
          is_photo_quality_good?: boolean | null
          is_processed?: boolean
          is_timestamp_valid?: boolean | null
          mime_type?: string
          photo_address?: string | null
          photo_lat?: number | null
          photo_lng?: number | null
          photo_url?: string
          processing_errors?: string[] | null
          submission_id?: string
          taken_at?: string | null
          thumbnail_url?: string | null
          uploaded_at?: string
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_photos_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          answers: Json
          case_id: string
          created_at: string
          device_info: Json
          gig_partner_id: string
          gps_accuracy_meters: number | null
          id: string
          is_offline_submission: boolean
          location_verified: boolean
          notes: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submission_address: string | null
          submission_ip: string | null
          submission_lat: number | null
          submission_lng: number | null
          submitted_at: string
          synced_at: string | null
          updated_at: string
          user_agent: string | null
          vendor_id: string | null
        }
        Insert: {
          answers?: Json
          case_id: string
          created_at?: string
          device_info?: Json
          gig_partner_id: string
          gps_accuracy_meters?: number | null
          id?: string
          is_offline_submission?: boolean
          location_verified?: boolean
          notes?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submission_address?: string | null
          submission_ip?: string | null
          submission_lat?: number | null
          submission_lng?: number | null
          submitted_at?: string
          synced_at?: string | null
          updated_at?: string
          user_agent?: string | null
          vendor_id?: string | null
        }
        Update: {
          answers?: Json
          case_id?: string
          created_at?: string
          device_info?: Json
          gig_partner_id?: string
          gps_accuracy_meters?: number | null
          id?: string
          is_offline_submission?: boolean
          location_verified?: boolean
          notes?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submission_address?: string | null
          submission_ip?: string | null
          submission_lat?: number | null
          submission_lng?: number | null
          submitted_at?: string
          synced_at?: string | null
          updated_at?: string
          user_agent?: string | null
          vendor_id?: string | null
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
          },
          {
            foreignKeyName: "submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      system_configs: {
        Row: {
          config_category: string
          config_key: string
          config_value: Json
          created_at: string
          created_by: string
          description: string | null
          effective_from: string
          effective_until: string | null
          environment: string
          id: string
          is_active: boolean
          is_sensitive: boolean
          updated_at: string
          updated_by: string
          validation_rules: Json
          value_type: string
        }
        Insert: {
          config_category: string
          config_key: string
          config_value: Json
          created_at?: string
          created_by: string
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          is_sensitive?: boolean
          updated_at?: string
          updated_by: string
          validation_rules?: Json
          value_type?: string
        }
        Update: {
          config_category?: string
          config_key?: string
          config_value?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          is_sensitive?: boolean
          updated_at?: string
          updated_by?: string
          validation_rules?: Json
          value_type?: string
        }
        Relationships: []
      }
      vendor_payouts: {
        Row: {
          bank_account: string | null
          bank_ifsc: string | null
          created_at: string
          disbursed_at: string | null
          gig_payout_total: number
          id: string
          net_vendor_amount: number
          payment_cycle_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["payment_status"]
          total_cases: number
          transaction_id: string | null
          updated_at: string
          upi_id: string | null
          vendor_commission: number
          vendor_id: string
          vendor_rate_total: number
        }
        Insert: {
          bank_account?: string | null
          bank_ifsc?: string | null
          created_at?: string
          disbursed_at?: string | null
          gig_payout_total?: number
          id?: string
          net_vendor_amount?: number
          payment_cycle_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          total_cases?: number
          transaction_id?: string | null
          updated_at?: string
          upi_id?: string | null
          vendor_commission?: number
          vendor_id: string
          vendor_rate_total?: number
        }
        Update: {
          bank_account?: string | null
          bank_ifsc?: string | null
          created_at?: string
          disbursed_at?: string | null
          gig_payout_total?: number
          id?: string
          net_vendor_amount?: number
          payment_cycle_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          total_cases?: number
          transaction_id?: string | null
          updated_at?: string
          upi_id?: string | null
          vendor_commission?: number
          vendor_id?: string
          vendor_rate_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payouts_payment_cycle_id_fkey"
            columns: ["payment_cycle_id"]
            isOneToOne: false
            referencedRelation: "payment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payouts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          active_cases_count: number
          address: string | null
          capacity_available: number
          city: string | null
          contact_person: string | null
          country: string
          coverage_pincodes: string[]
          created_at: string
          created_by: string
          email: string
          id: string
          is_active: boolean
          last_capacity_reset: string
          max_daily_capacity: number
          max_roster_size: number | null
          name: string
          payout_account_holder: string | null
          payout_bank_account: string | null
          payout_bank_ifsc: string | null
          payout_bank_name: string | null
          performance_score: number
          phone: string | null
          pincode: string | null
          profile_id: string | null
          qc_pass_count: number
          quality_score: number
          roster_size: number
          state: string | null
          total_cases_assigned: number
          updated_at: string
        }
        Insert: {
          active_cases_count?: number
          address?: string | null
          capacity_available?: number
          city?: string | null
          contact_person?: string | null
          country?: string
          coverage_pincodes?: string[]
          created_at?: string
          created_by: string
          email: string
          id?: string
          is_active?: boolean
          last_capacity_reset?: string
          max_daily_capacity?: number
          max_roster_size?: number | null
          name: string
          payout_account_holder?: string | null
          payout_bank_account?: string | null
          payout_bank_ifsc?: string | null
          payout_bank_name?: string | null
          performance_score?: number
          phone?: string | null
          pincode?: string | null
          profile_id?: string | null
          qc_pass_count?: number
          quality_score?: number
          roster_size?: number
          state?: string | null
          total_cases_assigned?: number
          updated_at?: string
        }
        Update: {
          active_cases_count?: number
          address?: string | null
          capacity_available?: number
          city?: string | null
          contact_person?: string | null
          country?: string
          coverage_pincodes?: string[]
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          is_active?: boolean
          last_capacity_reset?: string
          max_daily_capacity?: number
          max_roster_size?: number | null
          name?: string
          payout_account_holder?: string | null
          payout_bank_account?: string | null
          payout_bank_ifsc?: string | null
          payout_bank_name?: string | null
          performance_score?: number
          phone?: string | null
          pincode?: string | null
          profile_id?: string | null
          qc_pass_count?: number
          quality_score?: number
          roster_size?: number
          state?: string | null
          total_cases_assigned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_case_to_candidate: {
        Args: {
          p_candidate_id: string
          p_candidate_type: string
          p_case_id: string
          p_vendor_id?: string
        }
        Returns: boolean
      }
      allocate_cases_sequentially:
        | {
            Args: {
              p_case_ids: string[]
              p_pincode: string
              p_pincode_tier: string
            }
            Returns: Json
          }
        | {
            Args: { p_case_ids: string[] }
            Returns: {
              assignee_email: string
              assignee_id: string
              case_id: string
              error_message: string
              success: boolean
            }[]
          }
      allocate_cases_with_vendors:
        | {
            Args: {
              p_case_ids: string[]
              p_pincode: string
              p_pincode_tier: string
            }
            Returns: Json
          }
        | { Args: { p_case_ids: string[]; p_pincode: string }; Returns: Json }
      assign_case_to_gig_worker: {
        Args: {
          p_case_id: string
          p_gig_worker_id: string
          p_vendor_id?: string
        }
        Returns: boolean
      }
      auto_assign_qc_reviewer: { Args: { p_case_id: string }; Returns: string }
      calculate_bonus_amount: {
        Args: {
          p_bonuses: Json
          p_completion_hours: number
          p_tier: Database["public"]["Enums"]["pincode_tier"]
          p_working_hours_end: string
          p_working_hours_start: string
        }
        Returns: number
      }
      calculate_case_payment: {
        Args: { p_case_id: string }
        Returns: {
          base_rate: number
          beneficiary_id: string
          beneficiary_name: string
          beneficiary_type: Database["public"]["Enums"]["beneficiary_type"]
          bonus: number
          ops_override: number
          total_amount: number
          travel_allowance: number
        }[]
      }
      calculate_penalty_amount: {
        Args: {
          p_completion_hours: number
          p_penalties: Json
          p_tat_days: number
          p_tier: Database["public"]["Enums"]["pincode_tier"]
          p_working_hours_end: string
          p_working_hours_start: string
        }
        Returns: number
      }
      calculate_qc_score: {
        Args: {
          p_data_completeness: number
          p_location_accuracy: number
          p_photo_quality: number
        }
        Returns: number
      }
      calculate_total_payout: {
        Args: { base_rate: number; bonus?: number; penalty?: number }
        Returns: number
      }
      calculate_vendor_payouts: {
        Args: { p_cycle_id: string }
        Returns: number
      }
      can_access_case: { Args: { p_case_id: string }; Returns: boolean }
      can_manage_user: {
        Args: { _target_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      can_modify_case: { Args: { p_case_id: string }; Returns: boolean }
      cleanup_expired_setup_tokens: { Args: never; Returns: undefined }
      consume_capacity: {
        Args: { p_case_id: string; p_gig_partner_id: string }
        Returns: boolean
      }
      consume_vendor_capacity: {
        Args: { p_cases_count?: number; p_vendor_id: string }
        Returns: boolean
      }
      create_gig_worker_profile: {
        Args: {
          p_address: string
          p_alternate_phone?: string
          p_city: string
          p_country?: string
          p_coverage_pincodes?: string[]
          p_created_by?: string
          p_email: string
          p_first_name: string
          p_is_active?: boolean
          p_is_available?: boolean
          p_is_direct_gig?: boolean
          p_last_name: string
          p_max_daily_capacity?: number
          p_phone: string
          p_pincode: string
          p_state: string
          p_vendor_id?: string
        }
        Returns: string
      }
      create_payment_cycle: {
        Args: { p_created_by: string; p_end_date: string; p_start_date: string }
        Returns: string
      }
      create_qc_workflow: {
        Args: { p_case_id: string; p_submission_id?: string }
        Returns: string
      }
      create_user_complete: {
        Args: {
          client_data?: Json
          gig_worker_data?: Json
          user_email: string
          user_first_name: string
          user_last_name: string
          user_password: string
          user_phone: string
          user_role: string
          vendor_data?: Json
        }
        Returns: Json
      }
      create_user_complete_edge: {
        Args: {
          created_by_user_id: string
          user_email: string
          user_first_name: string
          user_last_name: string
          user_password: string
          user_phone: string
          user_role: string
          vendor_data?: Json
        }
        Returns: Json
      }
      create_user_no_permissions: {
        Args: {
          created_by_user_id: string
          user_email: string
          user_first_name: string
          user_last_name: string
          user_phone: string
          user_role: string
          vendor_data?: Json
        }
        Returns: Json
      }
      create_user_simple: {
        Args: {
          created_by_user_id: string
          user_email: string
          user_first_name: string
          user_last_name: string
          user_phone: string
          user_role: string
          vendor_data?: Json
        }
        Returns: Json
      }
      create_user_with_auth: {
        Args: {
          created_by_user_id: string
          user_email: string
          user_first_name: string
          user_last_name: string
          user_password: string
          user_phone: string
          user_role: string
          vendor_data?: Json
        }
        Returns: Json
      }
      fix_capacity_for_submitted_cases: { Args: never; Returns: Json }
      free_capacity: {
        Args: { p_case_id: string; p_gig_partner_id: string }
        Returns: undefined
      }
      free_vendor_capacity: {
        Args: { p_cases_count?: number; p_vendor_id: string }
        Returns: undefined
      }
      generate_auth_user_id: { Args: never; Returns: string }
      generate_case_number: { Args: never; Returns: string }
      generate_password_setup_token: {
        Args: { p_created_by: string; p_email: string; p_user_id: string }
        Returns: string
      }
      generate_payment_cycle_tag: { Args: never; Returns: string }
      generate_payment_lines: { Args: { p_cycle_id: string }; Returns: number }
      get_allocation_candidates: {
        Args: { p_case_id: string; p_pincode: string; p_pincode_tier: string }
        Returns: {
          acceptance_rate: number
          active_cases_count: number
          candidate_id: string
          candidate_name: string
          candidate_type: string
          capacity_available: number
          completion_rate: number
          coverage_pincodes: string[]
          distance_km: number
          email: string
          is_active: boolean
          is_available: boolean
          is_direct_gig: boolean
          last_assignment_at: string
          max_daily_capacity: number
          ontime_completion_rate: number
          performance_score: number
          phone: string
          pincode: string
          qc_pass_count: number
          quality_score: number
          total_cases_completed: number
          vendor_id: string
          vendor_name: string
          vendor_performance_score: number
          vendor_quality_score: number
        }[]
      }
      get_allocation_candidates_safe:
        | {
            Args: {
              p_case_id: string
              p_pincode: string
              p_pincode_tier: Database["public"]["Enums"]["pincode_tier"]
            }
            Returns: {
              acceptance_rate: number
              actual_assigned_cases: number
              assignment_type: string
              capacity_available: number
              completion_rate: number
              coverage_pincodes: string[]
              gig_partner_id: string
              last_assignment_at: string
              max_daily_capacity: number
              ontime_completion_rate: number
              quality_score: number
            }[]
          }
        | {
            Args: {
              p_case_id: string
              p_pincode: string
              p_pincode_tier: string
            }
            Returns: {
              acceptance_rate: number
              active_cases_count: number
              candidate_id: string
              candidate_name: string
              candidate_type: string
              capacity_available: number
              completion_rate: number
              coverage_pincodes: string[]
              distance_km: number
              email: string
              is_active: boolean
              is_available: boolean
              is_direct_gig: boolean
              last_assignment_at: string
              max_daily_capacity: number
              ontime_completion_rate: number
              performance_score: number
              phone: string
              pincode: string
              qc_pass_count: number
              quality_score: number
              total_cases_completed: number
              vendor_id: string
              vendor_name: string
              vendor_performance_score: number
              vendor_quality_score: number
            }[]
          }
      get_allocation_candidates_with_vendors: {
        Args: { p_case_count?: number; p_pincode: string }
        Returns: {
          acceptance_rate: number
          candidate_id: string
          candidate_type: string
          capacity_available: number
          completion_rate: number
          distance_km: number
          email: string
          is_direct_gig: boolean
          name: string
          ontime_completion_rate: number
          performance_score: number
          phone: string
          quality_score: number
          vendor_id: string
        }[]
      }
      get_case_defaults:
        | {
            Args: {
              p_client_id: string
              p_pincode: string
              p_tat_hours?: number
            }
            Returns: {
              base_rate_inr: number
              bonuses: Json
              city: string
              penalties: Json
              state: string
              tat_hours: number
              tier: Database["public"]["Enums"]["pincode_tier"]
              total_rate_inr: number
              working_hours_end: string
              working_hours_start: string
            }[]
          }
        | {
            Args: {
              p_client_id: string
              p_contract_type: string
              p_pincode: string
              p_tat_hours?: number
            }
            Returns: {
              base_rate_inr: number
              bonuses: Json
              city: string
              penalties: Json
              state: string
              tat_hours: number
              tier: Database["public"]["Enums"]["pincode_tier"]
              total_rate_inr: number
              working_hours_end: string
              working_hours_start: string
            }[]
          }
      get_client_contract_pricing: {
        Args: {
          p_client_id: string
          p_tier: Database["public"]["Enums"]["pincode_tier"]
        }
        Returns: {
          base_payout_inr: number
          bonuses: Json
          penalties: Json
          revenue_inr: number
          tat_days: number
          working_hours_end: string
          working_hours_start: string
        }[]
      }
      get_current_user_id: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_location_from_pincode: {
        Args: { p_pincode: string }
        Returns: {
          city: string
          state: string
          tier: Database["public"]["Enums"]["pincode_tier"]
        }[]
      }
      get_pincode_tier: {
        Args: { p_pincode: string }
        Returns: Database["public"]["Enums"]["pincode_tier"]
      }
      get_qc_review_for_case: {
        Args: { p_case_id: string }
        Returns: {
          comments: string
          id: string
          issues_found: string[]
          result: string
          reviewed_at: string
          reviewer_id: string
          rework_deadline: string
          rework_instructions: string
        }[]
      }
      get_rate_card_for_client_tier: {
        Args: {
          p_client_id: string
          p_completion_slab: Database["public"]["Enums"]["completion_slab"]
          p_tier: Database["public"]["Enums"]["pincode_tier"]
        }
        Returns: {
          base_rate_inr: number
          bonus_inr: number
          rate_card_id: string
          rate_card_name: string
          travel_allowance_inr: number
        }[]
      }
      get_user_creation_data: { Args: { profile_id: string }; Returns: Json }
      get_vendor_assigned_cases: {
        Args: { vendor_uuid: string }
        Returns: {
          acceptance_deadline: string
          address_line: string
          base_rate_inr: number
          bonus_inr: number
          candidate_name: string
          case_number: string
          city: string
          client_case_id: string
          client_email: string
          client_id: string
          client_name: string
          contract_type: string
          created_at: string
          created_by: string
          current_assignee_id: string
          current_assignee_type: string
          current_vendor_id: string
          description: string
          due_at: string
          id: string
          instructions: string
          last_updated_by: string
          location_id: string
          metadata: Json
          penalty_inr: number
          phone_primary: string
          phone_secondary: string
          pincode: string
          priority: string
          rate_adjustments: Json
          source: string
          state: string
          status: string
          status_updated_at: string
          tat_hours: number
          title: string
          total_payout_inr: number
          total_rate_inr: number
          travel_allowance_inr: number
          updated_at: string
          vendor_tat_start_date: string
          visible_to_gig: boolean
        }[]
      }
      get_vendor_gig_workers: {
        Args: { vendor_uuid: string }
        Returns: {
          acceptance_rate: number
          active_cases_count: number
          address: string
          alternate_phone: string
          capacity_available: number
          city: string
          completion_rate: number
          country: string
          coverage_pincodes: string[]
          created_at: string
          created_by: string
          device_info: Json
          email: string
          first_name: string
          id: string
          is_active: boolean
          is_available: boolean
          is_direct_gig: boolean
          last_assignment_at: string
          last_capacity_reset: string
          last_name: string
          last_seen_at: string
          max_daily_capacity: number
          ontime_completion_rate: number
          phone: string
          pincode: string
          profile_id: string
          qc_pass_count: number
          quality_score: number
          state: string
          total_cases_completed: number
          updated_at: string
          user_id: string
          vendor_id: string
        }[]
      }
      gig_has_capacity: { Args: { p_gig_id: string }; Returns: boolean }
      handle_case_timeouts: { Args: never; Returns: undefined }
      has_role:
        | { Args: { role_name: string }; Returns: boolean }
        | {
            Args: { _role: Database["public"]["Enums"]["app_role"] }
            Returns: boolean
          }
      link_auth_user_to_profile: {
        Args: { auth_user_id: string; profile_id: string }
        Returns: Json
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_case_id?: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: string
      }
      mark_setup_token_used: {
        Args: { p_email: string; p_token: string }
        Returns: boolean
      }
      process_email_intake: {
        Args: {
          p_attachments?: Json
          p_body: string
          p_email_id: string
          p_sender_email: string
          p_subject: string
        }
        Returns: string
      }
      process_payment_cycle: {
        Args: { p_cycle_id: string; p_processed_by: string }
        Returns: boolean
      }
      process_qc_result: {
        Args: {
          p_comments?: string
          p_qc_review_id: string
          p_reason_code?: Database["public"]["Enums"]["qc_reason_code"]
          p_result: Database["public"]["Enums"]["qc_result"]
        }
        Returns: undefined
      }
      process_qc_review: {
        Args: { p_qc_review_id: string; p_result: string }
        Returns: undefined
      }
      reset_daily_capacity: { Args: never; Returns: undefined }
      reset_vendor_capacity: { Args: never; Returns: undefined }
      send_notification: {
        Args: {
          p_case_id?: string
          p_channel?: Database["public"]["Enums"]["notification_channel"]
          p_priority?: Database["public"]["Enums"]["notification_priority"]
          p_recipient_contact: string
          p_recipient_id: string
          p_recipient_type: string
          p_template_name: string
          p_variables?: Json
        }
        Returns: string
      }
      update_auto_allocation_with_vendors: {
        Args: {
          p_case_ids: string[]
          p_pincode: string
          p_pincode_tier: string
        }
        Returns: Json
      }
      update_case_status: {
        Args: {
          p_case_id: string
          p_status: Database["public"]["Enums"]["case_status_old"]
          p_updated_by: string
        }
        Returns: undefined
      }
      update_performance_metrics: {
        Args: { p_gig_partner_id: string; p_period_days?: number }
        Returns: undefined
      }
      validate_capacity_before_allocation: {
        Args: { p_gig_partner_id: string }
        Returns: boolean
      }
      validate_password_setup_token: {
        Args: { p_email: string; p_token: string }
        Returns: {
          expires_at: string
          is_valid: boolean
          user_id: string
        }[]
      }
      validate_photo_gps: {
        Args: {
          p_case_lat: number
          p_case_lng: number
          p_photo_lat: number
          p_photo_lng: number
          p_tolerance_meters?: number
        }
        Returns: boolean
      }
    }
    Enums: {
      allocation_decision:
        | "allocated"
        | "accepted"
        | "rejected"
        | "vendor_allocated"
        | "timeout"
        | "reallocated"
      allocation_wave:
        | "initial"
        | "reallocation_1"
        | "reallocation_2"
        | "reallocation_3"
        | "manual"
      app_role:
        | "super_admin"
        | "ops_team"
        | "vendor_team"
        | "qc_team"
        | "vendor"
        | "gig_worker"
        | "client"
      assignment_type: "gig" | "vendor"
      beneficiary_type: "gig" | "vendor"
      case_priority: "low" | "medium" | "high" | "urgent"
      case_source: "manual" | "bulk" | "email" | "api" | "client_portal"
      case_status:
        | "new"
        | "allocated"
        | "auto_allocated"
        | "accepted"
        | "pending_allocation"
        | "in_progress"
        | "submitted"
        | "qc_passed"
        | "qc_rejected"
        | "qc_rework"
        | "reported"
        | "completed"
        | "in_payment_cycle"
        | "payment_complete"
        | "cancelled"
      case_status_old:
        | "created"
        | "auto_allocated"
        | "pending_acceptance"
        | "accepted"
        | "in_progress"
        | "submitted"
        | "qc_pending"
        | "qc_passed"
        | "qc_rejected"
        | "qc_rework"
        | "completed"
        | "reported"
        | "in_payment_cycle"
        | "cancelled"
      completion_slab:
        | "within_24h"
        | "within_48h"
        | "within_72h"
        | "within_168h"
        | "beyond_168h"
      email_intake_status:
        | "pending"
        | "processing"
        | "success"
        | "failed"
        | "quarantined"
      form_field_type:
        | "short_answer"
        | "paragraph"
        | "multiple_choice"
        | "file_upload"
        | "number"
        | "date"
        | "boolean"
      form_field_validation: "mandatory" | "optional" | "conditional"
      notification_channel: "email" | "sms" | "whatsapp" | "push" | "ivr"
      notification_priority: "low" | "medium" | "high" | "urgent"
      notification_status:
        | "pending"
        | "sent"
        | "delivered"
        | "failed"
        | "cancelled"
      payment_cycle_status:
        | "draft"
        | "calculated"
        | "approved"
        | "processing"
        | "completed"
        | "cancelled"
      payment_method: "bank_transfer" | "upi" | "wallet" | "cash"
      payment_status:
        | "pending"
        | "calculated"
        | "approved"
        | "processing"
        | "disbursed"
        | "failed"
        | "cancelled"
      pincode_tier: "tier_1" | "tier_2" | "tier_3" | "tier1" | "tier2" | "tier3"
      qc_reason_code:
        | "insufficient_evidence"
        | "poor_photo_quality"
        | "incorrect_location"
        | "missing_required_fields"
        | "data_inconsistency"
        | "gps_mismatch"
        | "time_stamp_issue"
        | "other"
      QC_Response: "Rework" | "Approved" | "Rejected" | "New"
      qc_result: "pass" | "reject" | "rework"
      submission_status:
        | "draft"
        | "submitted"
        | "qc_pending"
        | "qc_passed"
        | "qc_rejected"
        | "qc_rework"
        | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
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
  public: {
    Enums: {
      allocation_decision: [
        "allocated",
        "accepted",
        "rejected",
        "vendor_allocated",
        "timeout",
        "reallocated",
      ],
      allocation_wave: [
        "initial",
        "reallocation_1",
        "reallocation_2",
        "reallocation_3",
        "manual",
      ],
      app_role: [
        "super_admin",
        "ops_team",
        "vendor_team",
        "qc_team",
        "vendor",
        "gig_worker",
        "client",
      ],
      assignment_type: ["gig", "vendor"],
      beneficiary_type: ["gig", "vendor"],
      case_priority: ["low", "medium", "high", "urgent"],
      case_source: ["manual", "bulk", "email", "api", "client_portal"],
      case_status: [
        "new",
        "allocated",
        "auto_allocated",
        "accepted",
        "pending_allocation",
        "in_progress",
        "submitted",
        "qc_passed",
        "qc_rejected",
        "qc_rework",
        "reported",
        "completed",
        "in_payment_cycle",
        "payment_complete",
        "cancelled",
      ],
      case_status_old: [
        "created",
        "auto_allocated",
        "pending_acceptance",
        "accepted",
        "in_progress",
        "submitted",
        "qc_pending",
        "qc_passed",
        "qc_rejected",
        "qc_rework",
        "completed",
        "reported",
        "in_payment_cycle",
        "cancelled",
      ],
      completion_slab: [
        "within_24h",
        "within_48h",
        "within_72h",
        "within_168h",
        "beyond_168h",
      ],
      email_intake_status: [
        "pending",
        "processing",
        "success",
        "failed",
        "quarantined",
      ],
      form_field_type: [
        "short_answer",
        "paragraph",
        "multiple_choice",
        "file_upload",
        "number",
        "date",
        "boolean",
      ],
      form_field_validation: ["mandatory", "optional", "conditional"],
      notification_channel: ["email", "sms", "whatsapp", "push", "ivr"],
      notification_priority: ["low", "medium", "high", "urgent"],
      notification_status: [
        "pending",
        "sent",
        "delivered",
        "failed",
        "cancelled",
      ],
      payment_cycle_status: [
        "draft",
        "calculated",
        "approved",
        "processing",
        "completed",
        "cancelled",
      ],
      payment_method: ["bank_transfer", "upi", "wallet", "cash"],
      payment_status: [
        "pending",
        "calculated",
        "approved",
        "processing",
        "disbursed",
        "failed",
        "cancelled",
      ],
      pincode_tier: ["tier_1", "tier_2", "tier_3", "tier1", "tier2", "tier3"],
      qc_reason_code: [
        "insufficient_evidence",
        "poor_photo_quality",
        "incorrect_location",
        "missing_required_fields",
        "data_inconsistency",
        "gps_mismatch",
        "time_stamp_issue",
        "other",
      ],
      QC_Response: ["Rework", "Approved", "Rejected", "New"],
      qc_result: ["pass", "reject", "rework"],
      submission_status: [
        "draft",
        "submitted",
        "qc_pending",
        "qc_passed",
        "qc_rejected",
        "qc_rework",
        "completed",
      ],
    },
  },
} as const
