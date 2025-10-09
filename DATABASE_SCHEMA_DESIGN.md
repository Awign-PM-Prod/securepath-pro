# Background Verification Platform - Database Schema Design

## Overview
This document outlines the complete database schema for the Background Verification Platform, designed to handle the full lifecycle from case intake to payment processing with capacity-aware allocation and quality control.

## Current State
- ✅ Basic user authentication and role management
- ✅ User profiles with role-based access control (RLS)
- ✅ Super admin, ops_team, vendor_team, qc_team, vendor, gig_worker, client roles

## Schema Design Principles
1. **Security First**: Row Level Security (RLS) on all tables
2. **Audit Trail**: Comprehensive logging of all changes
3. **Performance**: Optimized indexes for allocation engine queries
4. **Scalability**: Designed for high-volume case processing
5. **Data Integrity**: Foreign key constraints and validation rules

## Core Entities

### 1. Case Management
- **cases**: Main case entity with lifecycle tracking
- **case_attachments**: File attachments per case
- **case_assignments**: Assignment history and current assignee

### 2. Location & Geocoding
- **locations**: Standardized location data with geocoding
- **pincode_tiers**: Geographic tier classification system

### 3. User Management (Extended)
- **gig_partners**: Extended gig worker profiles with capacity
- **vendors**: Vendor organization profiles
- **clients**: Client organization profiles

### 4. Allocation & Capacity
- **allocation_logs**: Complete allocation history
- **capacity_tracking**: Real-time capacity management
- **performance_metrics**: Quality and performance scoring

### 5. Quality Control
- **submissions**: Field execution submissions
- **qc_reviews**: Quality control review records
- **submission_photos**: Photo evidence with metadata

### 6. Financial
- **rate_cards**: Dynamic pricing by pincode tier and completion time
- **payment_cycles**: Bi-weekly payment processing
- **payment_lines**: Individual payment line items

### 7. Communication
- **email_intake_logs**: Email parsing and case creation logs
- **notifications**: Multi-channel notification tracking
- **notification_templates**: Reusable notification templates

### 8. System Configuration
- **system_configs**: Configurable system parameters
- **client_contracts**: Client-specific terms and defaults
- **audit_logs**: System-wide audit trail

## Key Features

### Capacity Management
- Dynamic capacity tracking per gig worker
- Real-time capacity updates on case state changes
- Capacity reset scheduling and management

### Quality Scoring
- Multi-factor scoring algorithm (quality, completion rate, on-time rate, acceptance rate)
- Performance metrics tracking and updates
- Quality thresholds for allocation eligibility

### Rate Card System
- Pincode tier-based pricing (Tier-1 metro, Tier-2 city, Tier-3 rural)
- Completion time slab pricing (24h, 48h, 72h+)
- Ops overrides and post-assignment incentives
- Vendor vs direct gig rate visibility rules

### Audit & Security
- Complete audit trail for all operations
- PII encryption at rest
- Row-level security policies
- Image integrity validation

## Migration Strategy
1. **Phase 1**: Core entities (cases, locations, gig_partners, vendors, clients)
2. **Phase 2**: Allocation and capacity management
3. **Phase 3**: Quality control and submissions
4. **Phase 4**: Financial and payment processing
5. **Phase 5**: Communication and notifications
6. **Phase 6**: System configuration and audit

## Performance Considerations
- Indexes on frequently queried fields (pincode, status, assignee_id)
- Partitioning for high-volume tables (allocation_logs, audit_logs)
- Materialized views for complex reporting queries
- Connection pooling for allocation engine performance

## Security Considerations
- All tables have RLS enabled
- Sensitive data encrypted at rest
- Audit logging for all data modifications
- Role-based access control throughout
- Secure file storage with signed URLs

---

*This schema supports the complete background verification workflow from intake through payment, with sophisticated capacity management and quality controls.*


-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.allocation_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT allocation_config_pkey PRIMARY KEY (id),
  CONSTRAINT allocation_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.allocation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  candidate_type USER-DEFINED NOT NULL,
  vendor_id uuid,
  allocated_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  decision USER-DEFINED NOT NULL DEFAULT 'allocated'::allocation_decision,
  decision_at timestamp with time zone,
  wave_number integer NOT NULL DEFAULT 1,
  score_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_score numeric,
  acceptance_window_minutes integer NOT NULL DEFAULT 30,
  acceptance_deadline timestamp with time zone NOT NULL,
  reallocation_reason text,
  reallocated_by uuid,
  reallocated_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT allocation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT allocation_logs_reallocated_by_fkey FOREIGN KEY (reallocated_by) REFERENCES auth.users(id),
  CONSTRAINT allocation_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT allocation_logs_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id),
  CONSTRAINT allocation_logs_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.gig_partners(id),
  CONSTRAINT allocation_logs_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_fields ARRAY,
  case_id uuid,
  user_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.capacity_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gig_partner_id uuid NOT NULL,
  date date NOT NULL,
  max_daily_capacity integer NOT NULL,
  initial_capacity_available integer NOT NULL,
  current_capacity_available integer NOT NULL,
  cases_allocated integer NOT NULL DEFAULT 0,
  cases_accepted integer NOT NULL DEFAULT 0,
  cases_in_progress integer NOT NULL DEFAULT 0,
  cases_submitted integer NOT NULL DEFAULT 0,
  cases_completed integer NOT NULL DEFAULT 0,
  last_capacity_consumed_at timestamp with time zone,
  last_capacity_freed_at timestamp with time zone,
  last_reset_at timestamp with time zone NOT NULL DEFAULT now(),
  reset_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT capacity_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT capacity_tracking_gig_partner_id_fkey FOREIGN KEY (gig_partner_id) REFERENCES public.gig_partners(id)
);
CREATE TABLE public.case_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  mime_type text,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  is_processed boolean NOT NULL DEFAULT false,
  CONSTRAINT case_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT case_attachments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id),
  CONSTRAINT case_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
);
CREATE TABLE public.cases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  priority USER-DEFINED NOT NULL DEFAULT 'medium'::case_priority,
  source USER-DEFINED NOT NULL DEFAULT 'manual'::case_source,
  client_id uuid NOT NULL,
  location_id uuid NOT NULL,
  tat_hours integer NOT NULL,
  due_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  current_assignee_id uuid,
  current_assignee_type USER-DEFINED,
  current_vendor_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'created'::case_status,
  status_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  rate_card_id uuid,
  base_rate_inr numeric NOT NULL DEFAULT 0.00,
  rate_adjustments jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_rate_inr numeric NOT NULL DEFAULT 0.00,
  visible_to_gig boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  last_updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT cases_pkey PRIMARY KEY (id),
  CONSTRAINT cases_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT cases_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT cases_current_assignee_id_fkey FOREIGN KEY (current_assignee_id) REFERENCES public.gig_partners(id),
  CONSTRAINT cases_current_vendor_id_fkey FOREIGN KEY (current_vendor_id) REFERENCES public.vendors(id),
  CONSTRAINT cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT cases_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.client_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  contract_number text NOT NULL,
  contract_name text NOT NULL,
  contract_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_tat_hours integer NOT NULL DEFAULT 24,
  priority_tat_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  rate_card_id uuid,
  rate_override_policy text NOT NULL DEFAULT 'standard'::text,
  report_delivery_method text NOT NULL DEFAULT 'email'::text,
  report_delivery_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalation_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  escalation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT client_contracts_pkey PRIMARY KEY (id),
  CONSTRAINT client_contracts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT client_contracts_rate_card_id_fkey FOREIGN KEY (rate_card_id) REFERENCES public.rate_cards(id),
  CONSTRAINT client_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  contact_person text,
  address text,
  city text,
  state text,
  pincode text,
  country text NOT NULL DEFAULT 'India'::text,
  contract_start_date date,
  contract_end_date date,
  contract_terms jsonb,
  escalation_contacts jsonb,
  default_tats jsonb,
  rate_card_policy text,
  report_delivery_method text NOT NULL DEFAULT 'email'::text,
  report_delivery_config jsonb,
  ingestion_email text,
  ingestion_drive_folder_id text,
  ingestion_api_key text,
  allowed_sender_domains ARRAY,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.communication_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  ivr_enabled boolean NOT NULL DEFAULT false,
  allocation_notifications boolean NOT NULL DEFAULT true,
  acceptance_reminders boolean NOT NULL DEFAULT true,
  qc_results boolean NOT NULL DEFAULT true,
  payment_notifications boolean NOT NULL DEFAULT true,
  system_alerts boolean NOT NULL DEFAULT true,
  quiet_hours_start time without time zone,
  quiet_hours_end time without time zone,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata'::text,
  preferred_language text NOT NULL DEFAULT 'en'::text,
  preferred_region text NOT NULL DEFAULT 'IN'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT communication_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT communication_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.email_intake_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email_id text NOT NULL,
  message_id text,
  sender_email text NOT NULL,
  sender_domain text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  received_at timestamp with time zone NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::email_intake_status,
  processed_at timestamp with time zone,
  case_id uuid,
  parsed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsing_errors ARRAY,
  is_trusted_sender boolean NOT NULL DEFAULT false,
  client_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_intake_logs_pkey PRIMARY KEY (id),
  CONSTRAINT email_intake_logs_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id),
  CONSTRAINT email_intake_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.financial_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  report_period_start date NOT NULL,
  report_period_end date NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_url text,
  file_format text,
  file_size integer,
  status text NOT NULL DEFAULT 'generating'::text,
  generated_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT financial_reports_pkey PRIMARY KEY (id),
  CONSTRAINT financial_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.gig_partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  profile_id uuid NOT NULL UNIQUE,
  phone text NOT NULL,
  alternate_phone text,
  address text,
  city text,
  state text,
  pincode text,
  country text NOT NULL DEFAULT 'India'::text,
  coverage_pincodes ARRAY NOT NULL DEFAULT '{}'::text[],
  max_daily_capacity integer NOT NULL DEFAULT 1,
  capacity_available integer NOT NULL DEFAULT 1,
  last_capacity_reset timestamp with time zone NOT NULL DEFAULT now(),
  completion_rate numeric NOT NULL DEFAULT 0.00,
  ontime_completion_rate numeric NOT NULL DEFAULT 0.00,
  acceptance_rate numeric NOT NULL DEFAULT 0.00,
  quality_score numeric NOT NULL DEFAULT 0.00,
  qc_pass_count integer NOT NULL DEFAULT 0,
  total_cases_completed integer NOT NULL DEFAULT 0,
  active_cases_count integer NOT NULL DEFAULT 0,
  last_assignment_at timestamp with time zone,
  vendor_id uuid,
  is_direct_gig boolean NOT NULL DEFAULT true,
  device_info jsonb,
  last_seen_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  is_available boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gig_partners_pkey PRIMARY KEY (id),
  CONSTRAINT gig_partners_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT gig_partners_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT gig_partners_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
  CONSTRAINT gig_partners_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  address_line text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  country text NOT NULL DEFAULT 'India'::text,
  pincode text NOT NULL,
  lat numeric,
  lng numeric,
  pincode_tier USER-DEFINED NOT NULL,
  geocoded_at timestamp with time zone,
  geocoding_accuracy text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notification_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_name text NOT NULL UNIQUE,
  template_type text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels ARRAY NOT NULL DEFAULT '{}'::notification_channel[],
  priority USER-DEFINED NOT NULL DEFAULT 'medium'::notification_priority,
  language text NOT NULL DEFAULT 'en'::text,
  region text NOT NULL DEFAULT 'IN'::text,
  is_active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_templates_pkey PRIMARY KEY (id),
  CONSTRAINT notification_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid,
  recipient_type text NOT NULL,
  recipient_id uuid NOT NULL,
  recipient_contact text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel USER-DEFINED NOT NULL,
  priority USER-DEFINED NOT NULL DEFAULT 'medium'::notification_priority,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::notification_status,
  scheduled_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  external_id text,
  delivery_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  case_id uuid,
  related_entity_type text,
  related_entity_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id),
  CONSTRAINT notifications_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id),
  CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.payment_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_line_id uuid NOT NULL,
  adjustment_type text NOT NULL,
  adjustment_reason text NOT NULL,
  amount_inr numeric NOT NULL,
  case_id uuid,
  reference_document text,
  approved_by uuid NOT NULL,
  approved_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT payment_adjustments_payment_line_id_fkey FOREIGN KEY (payment_line_id) REFERENCES public.payment_lines(id),
  CONSTRAINT payment_adjustments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id),
  CONSTRAINT payment_adjustments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id),
  CONSTRAINT payment_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.payment_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_config_pkey PRIMARY KEY (id),
  CONSTRAINT payment_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.payment_cycles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_tag text NOT NULL UNIQUE,
  cycle_start_date date NOT NULL,
  cycle_end_date date NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::payment_cycle_status,
  total_cases integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0.00,
  total_adjustments numeric NOT NULL DEFAULT 0.00,
  net_amount numeric NOT NULL DEFAULT 0.00,
  calculated_at timestamp with time zone,
  approved_at timestamp with time zone,
  processing_started_at timestamp with time zone,
  completed_at timestamp with time zone,
  approved_by uuid,
  processing_notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_cycles_pkey PRIMARY KEY (id),
  CONSTRAINT payment_cycles_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id),
  CONSTRAINT payment_cycles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.payment_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_cycle_id uuid NOT NULL,
  case_id uuid NOT NULL,
  beneficiary_type USER-DEFINED NOT NULL,
  beneficiary_id uuid NOT NULL,
  beneficiary_name text NOT NULL,
  base_rate_inr numeric NOT NULL DEFAULT 0.00,
  travel_allowance_inr numeric NOT NULL DEFAULT 0.00,
  bonus_inr numeric NOT NULL DEFAULT 0.00,
  ops_override_delta numeric NOT NULL DEFAULT 0.00,
  total_inr numeric NOT NULL DEFAULT 0.00,
  payment_method USER-DEFINED NOT NULL DEFAULT 'bank_transfer'::payment_method,
  bank_account text,
  bank_ifsc text,
  upi_id text,
  wallet_id text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  disbursed_at timestamp with time zone,
  transaction_id text,
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_lines_pkey PRIMARY KEY (id),
  CONSTRAINT payment_lines_payment_cycle_id_fkey FOREIGN KEY (payment_cycle_id) REFERENCES public.payment_cycles(id),
  CONSTRAINT payment_lines_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id)
);
CREATE TABLE public.performance_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gig_partner_id uuid NOT NULL,
  vendor_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_cases_assigned integer NOT NULL DEFAULT 0,
  total_cases_accepted integer NOT NULL DEFAULT 0,
  total_cases_completed integer NOT NULL DEFAULT 0,
  total_cases_on_time integer NOT NULL DEFAULT 0,
  total_cases_qc_passed integer NOT NULL DEFAULT 0,
  total_cases_qc_rejected integer NOT NULL DEFAULT 0,
  completion_rate numeric NOT NULL DEFAULT 0.0000,
  ontime_completion_rate numeric NOT NULL DEFAULT 0.0000,
  acceptance_rate numeric NOT NULL DEFAULT 0.0000,
  quality_score numeric NOT NULL DEFAULT 0.0000,
  avg_acceptance_time_minutes numeric,
  avg_completion_time_hours numeric,
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT performance_metrics_gig_partner_id_fkey FOREIGN KEY (gig_partner_id) REFERENCES public.gig_partners(id),
  CONSTRAINT performance_metrics_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  role USER-DEFINED NOT NULL DEFAULT 'gig_worker'::app_role,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.qc_quality_standards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  standard_name text NOT NULL,
  standard_type text NOT NULL,
  min_score integer NOT NULL DEFAULT 70,
  max_score integer NOT NULL DEFAULT 100,
  criteria_description text NOT NULL,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT qc_quality_standards_pkey PRIMARY KEY (id),
  CONSTRAINT qc_quality_standards_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.qc_reason_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code USER-DEFINED NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  requires_comment boolean NOT NULL DEFAULT false,
  severity_level integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT qc_reason_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.qc_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  case_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewed_at timestamp with time zone NOT NULL DEFAULT now(),
  result USER-DEFINED NOT NULL,
  reason_code USER-DEFINED,
  comments text,
  photo_quality_score integer CHECK (photo_quality_score >= 0 AND photo_quality_score <= 100),
  location_accuracy_score integer CHECK (location_accuracy_score >= 0 AND location_accuracy_score <= 100),
  data_completeness_score integer CHECK (data_completeness_score >= 0 AND data_completeness_score <= 100),
  overall_score integer CHECK (overall_score >= 0 AND overall_score <= 100),
  issues_found ARRAY,
  improvement_suggestions text,
  rework_instructions text,
  rework_deadline timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT qc_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT qc_reviews_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id),
  CONSTRAINT qc_reviews_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id),
  CONSTRAINT qc_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id)
);
CREATE TABLE public.qc_workflow (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  submission_id uuid,
  current_stage text NOT NULL,
  assigned_to uuid,
  assigned_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  sla_deadline timestamp with time zone,
  priority integer NOT NULL DEFAULT 5,
  auto_assigned boolean NOT NULL DEFAULT true,
  internal_notes text,
  external_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT qc_workflow_pkey PRIMARY KEY (id),
  CONSTRAINT qc_workflow_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id),
  CONSTRAINT qc_workflow_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id),
  CONSTRAINT qc_workflow_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id)
);
CREATE TABLE public.rate_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid,
  pincode_tier USER-DEFINED NOT NULL,
  completion_slab USER-DEFINED NOT NULL,
  base_rate_inr numeric NOT NULL,
  default_travel_inr numeric NOT NULL DEFAULT 0.00,
  default_bonus_inr numeric NOT NULL DEFAULT 0.00,
  is_active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rate_cards_pkey PRIMARY KEY (id),
  CONSTRAINT rate_cards_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT rate_cards_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.submission_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  photo_url text NOT NULL,
  thumbnail_url text,
  file_name text NOT NULL,
  file_size integer,
  mime_type text NOT NULL,
  photo_lat numeric,
  photo_lng numeric,
  photo_address text,
  exif_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  taken_at timestamp with time zone,
  is_gps_valid boolean,
  is_timestamp_valid boolean,
  is_photo_quality_good boolean,
  validation_notes text,
  is_processed boolean NOT NULL DEFAULT false,
  processing_errors ARRAY,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT submission_photos_pkey PRIMARY KEY (id),
  CONSTRAINT submission_photos_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id)
);
CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  gig_partner_id uuid NOT NULL,
  vendor_id uuid,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  status USER-DEFINED NOT NULL DEFAULT 'submitted'::submission_status,
  submission_lat numeric,
  submission_lng numeric,
  submission_address text,
  gps_accuracy_meters numeric,
  location_verified boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  submission_ip text,
  user_agent text,
  is_offline_submission boolean NOT NULL DEFAULT false,
  synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id),
  CONSTRAINT submissions_gig_partner_id_fkey FOREIGN KEY (gig_partner_id) REFERENCES public.gig_partners(id),
  CONSTRAINT submissions_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
);
CREATE TABLE public.system_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  config_category text NOT NULL,
  config_key text NOT NULL,
  config_value jsonb NOT NULL,
  description text,
  value_type text NOT NULL DEFAULT 'json'::text,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  environment text NOT NULL DEFAULT 'production'::text,
  is_sensitive boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamp with time zone NOT NULL DEFAULT now(),
  effective_until timestamp with time zone,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_configs_pkey PRIMARY KEY (id),
  CONSTRAINT system_configs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT system_configs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.vendor_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  payment_cycle_id uuid NOT NULL,
  total_cases integer NOT NULL DEFAULT 0,
  vendor_rate_total numeric NOT NULL DEFAULT 0.00,
  gig_payout_total numeric NOT NULL DEFAULT 0.00,
  vendor_commission numeric NOT NULL DEFAULT 0.00,
  net_vendor_amount numeric NOT NULL DEFAULT 0.00,
  payment_method USER-DEFINED NOT NULL DEFAULT 'bank_transfer'::payment_method,
  bank_account text,
  bank_ifsc text,
  upi_id text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  disbursed_at timestamp with time zone,
  transaction_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vendor_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT vendor_payouts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
  CONSTRAINT vendor_payouts_payment_cycle_id_fkey FOREIGN KEY (payment_cycle_id) REFERENCES public.payment_cycles(id)
);
CREATE TABLE public.vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  contact_person text,
  address text,
  city text,
  state text,
  pincode text,
  country text NOT NULL DEFAULT 'India'::text,
  coverage_pincodes ARRAY NOT NULL DEFAULT '{}'::text[],
  performance_score numeric NOT NULL DEFAULT 0.00,
  quality_score numeric NOT NULL DEFAULT 0.00,
  qc_pass_count integer NOT NULL DEFAULT 0,
  total_cases_assigned integer NOT NULL DEFAULT 0,
  payout_bank_account text,
  payout_bank_ifsc text,
  payout_bank_name text,
  payout_account_holder text,
  roster_size integer NOT NULL DEFAULT 0,
  max_roster_size integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vendors_pkey PRIMARY KEY (id),
  CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
