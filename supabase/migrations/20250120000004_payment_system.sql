-- =====================================================
-- Payment & Financial System Migration
-- Background Verification Platform - Phase 1
-- =====================================================

-- Create enums for payment system
CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'calculated',
  'approved',
  'processing',
  'disbursed',
  'failed',
  'cancelled'
);

CREATE TYPE public.beneficiary_type AS ENUM (
  'gig',
  'vendor'
);

CREATE TYPE public.payment_method AS ENUM (
  'bank_transfer',
  'upi',
  'wallet',
  'cash'
);

CREATE TYPE public.payment_cycle_status AS ENUM (
  'draft',
  'calculated',
  'approved',
  'processing',
  'completed',
  'cancelled'
);

-- =====================================================
-- PAYMENT CYCLES
-- =====================================================

CREATE TABLE public.payment_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_tag TEXT NOT NULL UNIQUE, -- Format: PC-YYYYMMDD-XXXX
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL,
  
  -- Cycle details
  status payment_cycle_status NOT NULL DEFAULT 'draft',
  total_cases INTEGER NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_adjustments DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  
  -- Processing details
  calculated_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Approval workflow
  approved_by UUID REFERENCES auth.users(id),
  processing_notes TEXT,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- PAYMENT LINES
-- =====================================================

CREATE TABLE public.payment_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_cycle_id UUID NOT NULL REFERENCES public.payment_cycles(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id),
  
  -- Beneficiary details
  beneficiary_type beneficiary_type NOT NULL,
  beneficiary_id UUID NOT NULL, -- References gig_partners.id or vendors.id
  beneficiary_name TEXT NOT NULL,
  
  -- Payment details
  base_rate_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  travel_allowance_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  bonus_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ops_override_delta DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  
  -- Payment method and details
  payment_method payment_method NOT NULL DEFAULT 'bank_transfer',
  bank_account TEXT,
  bank_ifsc TEXT,
  upi_id TEXT,
  wallet_id TEXT,
  
  -- Status and processing
  status payment_status NOT NULL DEFAULT 'pending',
  disbursed_at TIMESTAMP WITH TIME ZONE,
  transaction_id TEXT,
  failure_reason TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- PAYMENT ADJUSTMENTS
-- =====================================================

CREATE TABLE public.payment_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_line_id UUID NOT NULL REFERENCES public.payment_lines(id) ON DELETE CASCADE,
  
  -- Adjustment details
  adjustment_type TEXT NOT NULL, -- 'travel', 'bonus', 'ops_override', 'penalty', 'bonus'
  adjustment_reason TEXT NOT NULL,
  amount_inr DECIMAL(10,2) NOT NULL,
  
  -- Reference details
  case_id UUID REFERENCES public.cases(id),
  reference_document TEXT, -- URL or reference to supporting document
  
  -- Approval
  approved_by UUID NOT NULL REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- VENDOR PAYOUTS
-- =====================================================

CREATE TABLE public.vendor_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  payment_cycle_id UUID NOT NULL REFERENCES public.payment_cycles(id),
  
  -- Payout details
  total_cases INTEGER NOT NULL DEFAULT 0,
  vendor_rate_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gig_payout_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  vendor_commission DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_vendor_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  
  -- Payment details
  payment_method payment_method NOT NULL DEFAULT 'bank_transfer',
  bank_account TEXT,
  bank_ifsc TEXT,
  upi_id TEXT,
  
  -- Status
  status payment_status NOT NULL DEFAULT 'pending',
  disbursed_at TIMESTAMP WITH TIME ZONE,
  transaction_id TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- PAYMENT CONFIGURATION
-- =====================================================

CREATE TABLE public.payment_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default payment configuration
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Try to get admin user ID
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1;
  
  -- If no admin user found, get any super_admin user
  IF admin_user_id IS NULL THEN
    SELECT p.user_id INTO admin_user_id 
    FROM public.profiles p 
    WHERE p.role = 'super_admin' AND p.is_active = true 
    LIMIT 1;
  END IF;
  
  -- If still no user found, get any user
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  END IF;
  
  -- Insert payment configuration only if we have a valid user ID
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.payment_config (config_key, config_value, description, updated_by) VALUES
    ('payment_cycle', '{"frequency": "bi_weekly", "day_of_week": "friday", "processing_delay_days": 2}', 'Payment cycle frequency and timing', admin_user_id),
    ('vendor_commission', '{"rate": 0.15, "min_cases": 5, "bonus_threshold": 20}', 'Vendor commission rates and thresholds', admin_user_id),
    ('payment_methods', '{"default": "bank_transfer", "supported": ["bank_transfer", "upi"], "min_amount": 100}', 'Supported payment methods and limits', admin_user_id),
    ('approval_workflow', '{"auto_approve_threshold": 1000, "requires_approval_roles": ["super_admin", "ops_team"]}', 'Payment approval workflow settings', admin_user_id);
  END IF;
END $$;

-- =====================================================
-- FINANCIAL REPORTS
-- =====================================================

CREATE TABLE public.financial_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type TEXT NOT NULL, -- 'payment_cycle', 'vendor_summary', 'client_billing', 'revenue_analysis'
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  
  -- Report data
  report_data JSONB NOT NULL DEFAULT '{}',
  summary_data JSONB NOT NULL DEFAULT '{}',
  
  -- File details
  file_url TEXT,
  file_format TEXT, -- 'pdf', 'excel', 'csv'
  file_size INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'generating', -- 'generating', 'ready', 'failed'
  generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Payment cycles indexes
CREATE INDEX idx_payment_cycles_cycle_tag ON public.payment_cycles(cycle_tag);
CREATE INDEX idx_payment_cycles_status ON public.payment_cycles(status);
CREATE INDEX idx_payment_cycles_dates ON public.payment_cycles(cycle_start_date, cycle_end_date);

-- Payment lines indexes
CREATE INDEX idx_payment_lines_cycle_id ON public.payment_lines(payment_cycle_id);
CREATE INDEX idx_payment_lines_case_id ON public.payment_lines(case_id);
CREATE INDEX idx_payment_lines_beneficiary ON public.payment_lines(beneficiary_type, beneficiary_id);
CREATE INDEX idx_payment_lines_status ON public.payment_lines(status);

-- Payment adjustments indexes
CREATE INDEX idx_payment_adjustments_payment_line_id ON public.payment_adjustments(payment_line_id);
CREATE INDEX idx_payment_adjustments_case_id ON public.payment_adjustments(case_id);
CREATE INDEX idx_payment_adjustments_type ON public.payment_adjustments(adjustment_type);

-- Vendor payouts indexes
CREATE INDEX idx_vendor_payouts_vendor_id ON public.vendor_payouts(vendor_id);
CREATE INDEX idx_vendor_payouts_cycle_id ON public.vendor_payouts(payment_cycle_id);
CREATE INDEX idx_vendor_payouts_status ON public.vendor_payouts(status);

-- Financial reports indexes
CREATE INDEX idx_financial_reports_type ON public.financial_reports(report_type);
CREATE INDEX idx_financial_reports_period ON public.financial_reports(report_period_start, report_period_end);
CREATE INDEX idx_financial_reports_status ON public.financial_reports(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.payment_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PAYMENT FUNCTIONS
-- =====================================================

-- Function to generate payment cycle tag
CREATE OR REPLACE FUNCTION public.generate_payment_cycle_tag()
RETURNS TEXT AS $$
DECLARE
  cycle_tag TEXT;
  counter INTEGER;
BEGIN
  -- Format: PC-YYYYMMDD-XXXX
  SELECT COUNT(*) + 1 INTO counter 
  FROM public.payment_cycles 
  WHERE DATE(created_at) = CURRENT_DATE;
  
  cycle_tag := 'PC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN cycle_tag;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate payment for a case
CREATE OR REPLACE FUNCTION public.calculate_case_payment(
  p_case_id UUID
)
RETURNS TABLE (
  base_rate DECIMAL(10,2),
  travel_allowance DECIMAL(10,2),
  bonus DECIMAL(10,2),
  ops_override DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  beneficiary_type beneficiary_type,
  beneficiary_id UUID,
  beneficiary_name TEXT
) AS $$
DECLARE
  case_record RECORD;
  gig_record RECORD;
  vendor_record RECORD;
BEGIN
  -- Get case details
  SELECT c.*, l.pincode_tier
  INTO case_record
  FROM public.cases c
  JOIN public.locations l ON c.location_id = l.id
  WHERE c.id = p_case_id;
  
  -- Get assignee details
  IF case_record.current_assignee_type = 'gig' THEN
    SELECT gp.*, p.first_name, p.last_name, v.name as vendor_name
    INTO gig_record
    FROM public.gig_partners gp
    JOIN public.profiles p ON gp.profile_id = p.id
    LEFT JOIN public.vendors v ON gp.vendor_id = v.id
    WHERE gp.id = case_record.current_assignee_id;
    
    -- Return gig payment details
    RETURN QUERY SELECT
      case_record.base_rate_inr,
      COALESCE((case_record.rate_adjustments->>'travel_inr')::DECIMAL(10,2), 0.00),
      COALESCE((case_record.rate_adjustments->>'bonus_inr')::DECIMAL(10,2), 0.00),
      COALESCE((case_record.rate_adjustments->>'ops_override_delta')::DECIMAL(10,2), 0.00),
      case_record.total_rate_inr,
      'gig'::beneficiary_type,
      gig_record.id,
      gig_record.first_name || ' ' || gig_record.last_name;
      
  ELSIF case_record.current_assignee_type = 'vendor' THEN
    SELECT v.*
    INTO vendor_record
    FROM public.vendors v
    WHERE v.id = case_record.current_vendor_id;
    
    -- Return vendor payment details
    RETURN QUERY SELECT
      case_record.base_rate_inr,
      COALESCE((case_record.rate_adjustments->>'travel_inr')::DECIMAL(10,2), 0.00),
      COALESCE((case_record.rate_adjustments->>'bonus_inr')::DECIMAL(10,2), 0.00),
      COALESCE((case_record.rate_adjustments->>'ops_override_delta')::DECIMAL(10,2), 0.00),
      case_record.total_rate_inr,
      'vendor'::beneficiary_type,
      vendor_record.id,
      vendor_record.name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create payment cycle
CREATE OR REPLACE FUNCTION public.create_payment_cycle(
  p_start_date DATE,
  p_end_date DATE,
  p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
  cycle_id UUID;
  cycle_tag TEXT;
  completed_cases INTEGER;
  total_amount DECIMAL(12,2);
BEGIN
  -- Generate cycle tag
  cycle_tag := public.generate_payment_cycle_tag();
  
  -- Count completed cases in period
  SELECT COUNT(*), COALESCE(SUM(total_rate_inr), 0.00)
  INTO completed_cases, total_amount
  FROM public.cases
  WHERE status IN ('completed', 'reported', 'in_payment_cycle')
    AND completed_at >= p_start_date
    AND completed_at <= p_end_date;
  
  -- Create payment cycle
  INSERT INTO public.payment_cycles (
    cycle_tag,
    cycle_start_date,
    cycle_end_date,
    total_cases,
    total_amount,
    net_amount,
    created_by
  ) VALUES (
    cycle_tag,
    p_start_date,
    p_end_date,
    completed_cases,
    total_amount,
    total_amount,
    p_created_by
  ) RETURNING id INTO cycle_id;
  
  RETURN cycle_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate payment lines for a cycle
CREATE OR REPLACE FUNCTION public.generate_payment_lines(
  p_cycle_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  cycle_record RECORD;
  case_record RECORD;
  payment_line_id UUID;
  lines_created INTEGER := 0;
BEGIN
  -- Get cycle details
  SELECT * INTO cycle_record FROM public.payment_cycles WHERE id = p_cycle_id;
  
  -- Process each completed case in the cycle period
  FOR case_record IN
    SELECT c.*, l.pincode_tier
    FROM public.cases c
    JOIN public.locations l ON c.location_id = l.id
    WHERE c.status IN ('completed', 'reported', 'in_payment_cycle')
      AND c.completed_at >= cycle_record.cycle_start_date
      AND c.completed_at <= cycle_record.cycle_end_date
  LOOP
    -- Create payment line for each case
    INSERT INTO public.payment_lines (
      payment_cycle_id,
      case_id,
      beneficiary_type,
      beneficiary_id,
      beneficiary_name,
      base_rate_inr,
      travel_allowance_inr,
      bonus_inr,
      ops_override_delta,
      total_inr
    )
    SELECT 
      p_cycle_id,
      case_record.id,
      payment_details.beneficiary_type,
      payment_details.beneficiary_id,
      payment_details.beneficiary_name,
      payment_details.base_rate,
      payment_details.travel_allowance,
      payment_details.bonus,
      payment_details.ops_override,
      payment_details.total_amount
    FROM public.calculate_case_payment(case_record.id) as payment_details;
    
    lines_created := lines_created + 1;
  END LOOP;
  
  RETURN lines_created;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate vendor payouts
CREATE OR REPLACE FUNCTION public.calculate_vendor_payouts(
  p_cycle_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  vendor_record RECORD;
  payout_id UUID;
  payouts_created INTEGER := 0;
  vendor_commission_config JSONB;
  commission_rate DECIMAL(3,2);
BEGIN
  -- Get vendor commission configuration
  SELECT config_value INTO vendor_commission_config
  FROM public.payment_config 
  WHERE config_key = 'vendor_commission';
  
  commission_rate := (vendor_commission_config->>'rate')::DECIMAL(3,2);
  
  -- Process each vendor
  FOR vendor_record IN
    SELECT 
      v.id as vendor_id,
      v.name as vendor_name,
      COUNT(pl.id) as total_cases,
      SUM(pl.base_rate_inr) as vendor_rate_total,
      SUM(pl.total_inr) as gig_payout_total,
      SUM(pl.base_rate_inr) * commission_rate as vendor_commission,
      SUM(pl.base_rate_inr) * (1 - commission_rate) as net_vendor_amount
    FROM public.vendors v
    JOIN public.payment_lines pl ON v.id = pl.beneficiary_id
    WHERE pl.payment_cycle_id = p_cycle_id
      AND pl.beneficiary_type = 'vendor'
    GROUP BY v.id, v.name
  LOOP
    -- Create vendor payout
    INSERT INTO public.vendor_payouts (
      vendor_id,
      payment_cycle_id,
      total_cases,
      vendor_rate_total,
      gig_payout_total,
      vendor_commission,
      net_vendor_amount,
      bank_account,
      bank_ifsc
    ) VALUES (
      vendor_record.vendor_id,
      p_cycle_id,
      vendor_record.total_cases,
      vendor_record.vendor_rate_total,
      vendor_record.gig_payout_total,
      vendor_record.vendor_commission,
      vendor_record.net_vendor_amount,
      (SELECT payout_bank_account FROM public.vendors WHERE id = vendor_record.vendor_id),
      (SELECT payout_bank_ifsc FROM public.vendors WHERE id = vendor_record.vendor_id)
    );
    
    payouts_created := payouts_created + 1;
  END LOOP;
  
  RETURN payouts_created;
END;
$$ LANGUAGE plpgsql;

-- Function to process payment cycle
CREATE OR REPLACE FUNCTION public.process_payment_cycle(
  p_cycle_id UUID,
  p_processed_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  cycle_record RECORD;
  lines_created INTEGER;
  payouts_created INTEGER;
BEGIN
  -- Get cycle details
  SELECT * INTO cycle_record FROM public.payment_cycles WHERE id = p_cycle_id;
  
  -- Generate payment lines
  lines_created := public.generate_payment_lines(p_cycle_id);
  
  -- Calculate vendor payouts
  payouts_created := public.calculate_vendor_payouts(p_cycle_id);
  
  -- Update cycle status
  UPDATE public.payment_cycles 
  SET 
    status = 'calculated',
    calculated_at = now(),
    updated_at = now()
  WHERE id = p_cycle_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger to update payment line totals when adjustments are made
CREATE OR REPLACE FUNCTION public.update_payment_line_totals()
RETURNS TRIGGER AS $$
DECLARE
  new_total DECIMAL(10,2);
BEGIN
  -- Calculate new total
  SELECT 
    base_rate_inr + travel_allowance_inr + bonus_inr + ops_override_delta
  INTO new_total
  FROM public.payment_lines
  WHERE id = NEW.payment_line_id;
  
  -- Update payment line total
  UPDATE public.payment_lines
  SET 
    total_inr = new_total,
    updated_at = now()
  WHERE id = NEW.payment_line_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_line_totals_trigger
  AFTER INSERT OR UPDATE ON public.payment_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_line_totals();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Payment cycles policies
CREATE POLICY "Finance team can manage payment cycles"
  ON public.payment_cycles FOR ALL
  USING (public.has_role('super_admin') OR public.has_role('ops_team'));

-- Payment lines policies
CREATE POLICY "Users can view their own payment lines"
  ON public.payment_lines FOR SELECT
  USING (
    beneficiary_type = 'gig' AND beneficiary_id IN (
      SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Finance team can manage payment lines"
  ON public.payment_lines FOR ALL
  USING (public.has_role('super_admin') OR public.has_role('ops_team'));

-- Vendor payouts policies
CREATE POLICY "Vendors can view their own payouts"
  ON public.vendor_payouts FOR SELECT
  USING (vendor_id IN (
    SELECT v.id FROM public.vendors v
    JOIN public.profiles p ON v.created_by = p.user_id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Finance team can manage vendor payouts"
  ON public.vendor_payouts FOR ALL
  USING (public.has_role('super_admin') OR public.has_role('ops_team'));

-- Financial reports policies
CREATE POLICY "Finance team can manage reports"
  ON public.financial_reports FOR ALL
  USING (public.has_role('super_admin') OR public.has_role('ops_team'));
