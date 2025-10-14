-- =====================================================
-- Core Entities Migration
-- Background Verification Platform - Phase 1
-- =====================================================

-- Create enums for case lifecycle and status
CREATE TYPE public.case_status AS ENUM (
  'created',
  'auto_allocated', 
  'pending_acceptance',
  'accepted',
  'in_progress',
  'submitted',
  'qc_pending',
  'qc_passed',
  'qc_rejected',
  'qc_rework',
  'completed',
  'reported',
  'in_payment_cycle',
  'cancelled'
);

CREATE TYPE public.case_priority AS ENUM (
  'low',
  'medium', 
  'high',
  'urgent'
);

CREATE TYPE public.case_source AS ENUM (
  'manual',
  'bulk',
  'email',
  'api',
  'client_portal'
);

CREATE TYPE public.assignment_type AS ENUM (
  'gig',
  'vendor'
);

CREATE TYPE public.pincode_tier AS ENUM (
  'tier_1',  -- Metro cities
  'tier_2',  -- Tier-2 cities
  'tier_3'   -- Towns/rural areas
);

CREATE TYPE public.completion_slab AS ENUM (
  'within_24h',
  'within_48h', 
  'within_72h',
  'within_168h',  -- 1 week
  'beyond_168h'
);

-- =====================================================
-- LOCATIONS & GEOCODING
-- =====================================================

CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  pincode TEXT NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  pincode_tier pincode_tier NOT NULL,
  geocoded_at TIMESTAMP WITH TIME ZONE,
  geocoding_accuracy TEXT, -- 'high', 'medium', 'low'
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for geocoding queries
CREATE INDEX idx_locations_pincode ON public.locations(pincode);
CREATE INDEX idx_locations_coordinates ON public.locations(lat, lng);
CREATE INDEX idx_locations_tier ON public.locations(pincode_tier);

-- =====================================================
-- CLIENTS
-- =====================================================

CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  contact_person TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  
  -- Contract details
  contract_start_date DATE,
  contract_end_date DATE,
  contract_terms JSONB,
  escalation_contacts JSONB, -- Array of contact objects
  
  -- Default settings
  default_tats JSONB, -- {case_type: hours}
  rate_card_policy TEXT, -- 'global', 'client_specific'
  
  -- Report delivery preferences
  report_delivery_method TEXT NOT NULL DEFAULT 'email', -- 'email', 'portal', 'webhook'
  report_delivery_config JSONB, -- Email templates, webhook URLs, etc.
  
  -- Ingestion settings
  ingestion_email TEXT,
  ingestion_drive_folder_id TEXT,
  ingestion_api_key TEXT,
  allowed_sender_domains TEXT[], -- For email intake security
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- VENDORS
-- =====================================================

CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  contact_person TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  
  -- Coverage areas
  coverage_pincodes TEXT[] NOT NULL DEFAULT '{}',
  
  -- Performance metrics
  performance_score DECIMAL(3,2) NOT NULL DEFAULT 0.00, -- 0.00 to 1.00
  quality_score DECIMAL(3,2) NOT NULL DEFAULT 0.00, -- QC pass rate
  qc_pass_count INTEGER NOT NULL DEFAULT 0,
  total_cases_assigned INTEGER NOT NULL DEFAULT 0,
  
  -- Payment details
  payout_bank_account TEXT,
  payout_bank_ifsc TEXT,
  payout_bank_name TEXT,
  payout_account_holder TEXT,
  
  -- Team management
  roster_size INTEGER NOT NULL DEFAULT 0,
  max_roster_size INTEGER,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- GIG PARTNERS (Extended from profiles)
-- =====================================================

CREATE TABLE public.gig_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Personal details
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  
  -- Coverage and capacity
  coverage_pincodes TEXT[] NOT NULL DEFAULT '{}',
  max_daily_capacity INTEGER NOT NULL DEFAULT 1,
  capacity_available INTEGER NOT NULL DEFAULT 1,
  last_capacity_reset TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Performance metrics
  completion_rate DECIMAL(3,2) NOT NULL DEFAULT 0.00, -- Last N cases
  ontime_completion_rate DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  acceptance_rate DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  quality_score DECIMAL(3,2) NOT NULL DEFAULT 0.00, -- QC pass rate
  qc_pass_count INTEGER NOT NULL DEFAULT 0,
  total_cases_completed INTEGER NOT NULL DEFAULT 0,
  
  -- Assignment tracking
  active_cases_count INTEGER NOT NULL DEFAULT 0,
  last_assignment_at TIMESTAMP WITH TIME ZONE,
  
  -- Vendor relationship
  vendor_id UUID REFERENCES public.vendors(id),
  is_direct_gig BOOLEAN NOT NULL DEFAULT true, -- true if not under vendor
  
  -- Device and app info
  device_info JSONB, -- Device type, OS, app version
  last_seen_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- CASES
-- =====================================================

CREATE TABLE public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE, -- Human-readable case number
  
  -- Basic case info
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority case_priority NOT NULL DEFAULT 'medium',
  source case_source NOT NULL DEFAULT 'manual',
  
  -- Client relationship
  client_id UUID NOT NULL REFERENCES public.clients(id),
  
  -- Location
  location_id UUID NOT NULL REFERENCES public.locations(id),
  
  -- SLA and timing
  tat_hours INTEGER NOT NULL, -- Turnaround time in hours
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Assignment
  current_assignee_id UUID REFERENCES public.gig_partners(id),
  current_assignee_type assignment_type,
  current_vendor_id UUID REFERENCES public.vendors(id),
  
  -- Status tracking
  status case_status NOT NULL DEFAULT 'created',
  status_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Rate and payment info
  rate_card_id UUID, -- Will reference rate_cards table
  base_rate_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  rate_adjustments JSONB NOT NULL DEFAULT '{}', -- {travel_inr, bonus_inr, override_reason}
  total_rate_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  visible_to_gig BOOLEAN NOT NULL DEFAULT true, -- false for vendor-routed cases
  
  -- Audit trail
  created_by UUID NOT NULL REFERENCES auth.users(id),
  last_updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}' -- Additional case-specific data
);

-- =====================================================
-- CASE ATTACHMENTS
-- =====================================================

CREATE TABLE public.case_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  mime_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_processed BOOLEAN NOT NULL DEFAULT false
);

-- =====================================================
-- RATE CARDS
-- =====================================================

CREATE TABLE public.rate_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id), -- NULL for global rate cards
  pincode_tier pincode_tier NOT NULL,
  completion_slab completion_slab NOT NULL,
  base_rate_inr DECIMAL(10,2) NOT NULL,
  default_travel_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  default_bonus_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination
  UNIQUE(client_id, pincode_tier, completion_slab, effective_from)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Cases indexes
CREATE INDEX idx_cases_status ON public.cases(status);
CREATE INDEX idx_cases_client_id ON public.cases(client_id);
CREATE INDEX idx_cases_assignee ON public.cases(current_assignee_id);
CREATE INDEX idx_cases_due_at ON public.cases(due_at);
CREATE INDEX idx_cases_created_at ON public.cases(created_at);
CREATE INDEX idx_cases_case_number ON public.cases(case_number);

-- Gig partners indexes
CREATE INDEX idx_gig_partners_vendor_id ON public.gig_partners(vendor_id);
CREATE INDEX idx_gig_partners_coverage ON public.gig_partners USING GIN(coverage_pincodes);
CREATE INDEX idx_gig_partners_capacity ON public.gig_partners(capacity_available);
CREATE INDEX idx_gig_partners_active ON public.gig_partners(is_active, is_available);

-- Vendors indexes
CREATE INDEX idx_vendors_coverage ON public.vendors USING GIN(coverage_pincodes);
CREATE INDEX idx_vendors_active ON public.vendors(is_active);

-- Locations indexes
CREATE INDEX idx_locations_pincode_tier ON public.locations(pincode_tier);

-- Rate cards indexes
CREATE INDEX idx_rate_cards_client_tier ON public.rate_cards(client_id, pincode_tier);
CREATE INDEX idx_rate_cards_active ON public.rate_cards(is_active, effective_from, effective_until);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gig_partners_updated_at
  BEFORE UPDATE ON public.gig_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rate_cards_updated_at
  BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to generate case number
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS TEXT AS $$
DECLARE
  case_number TEXT;
  counter INTEGER;
BEGIN
  -- Format: BG-YYYYMMDD-XXXXXX
  SELECT COUNT(*) + 1 INTO counter 
  FROM public.cases 
  WHERE DATE(created_at) = CURRENT_DATE;
  
  case_number := 'BG-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 6, '0');
  RETURN case_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update case status
CREATE OR REPLACE FUNCTION public.update_case_status(
  p_case_id UUID,
  p_status case_status,
  p_updated_by UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.cases 
  SET 
    status = p_status,
    status_updated_at = now(),
    last_updated_by = p_updated_by,
    updated_at = now()
  WHERE id = p_case_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if gig partner has capacity
CREATE OR REPLACE FUNCTION public.gig_has_capacity(p_gig_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  capacity_available INTEGER;
BEGIN
  SELECT capacity_available INTO capacity_available
  FROM public.gig_partners
  WHERE id = p_gig_id AND is_active = true;
  
  RETURN COALESCE(capacity_available, 0) > 0;
END;
$$ LANGUAGE plpgsql;

