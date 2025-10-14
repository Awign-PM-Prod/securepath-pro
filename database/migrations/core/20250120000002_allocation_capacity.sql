-- =====================================================
-- Allocation & Capacity Management Migration
-- Background Verification Platform - Phase 1
-- =====================================================

-- Create enums for allocation
CREATE TYPE public.allocation_decision AS ENUM (
  'allocated',
  'accepted',
  'rejected',
  'timeout',
  'reallocated'
);

CREATE TYPE public.allocation_wave AS ENUM (
  'initial',
  'reallocation_1',
  'reallocation_2',
  'reallocation_3',
  'manual'
);

-- =====================================================
-- ALLOCATION LOGS
-- =====================================================

CREATE TABLE public.allocation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.gig_partners(id),
  candidate_type assignment_type NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  
  -- Allocation details
  allocated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  decision allocation_decision NOT NULL DEFAULT 'allocated',
  decision_at TIMESTAMP WITH TIME ZONE,
  wave_number INTEGER NOT NULL DEFAULT 1,
  
  -- Scoring snapshot at allocation time
  score_snapshot JSONB NOT NULL DEFAULT '{}', -- {quality_score, completion_rate, ontime_rate, acceptance_rate, distance, etc.}
  final_score DECIMAL(5,4), -- Calculated final score
  
  -- Acceptance window
  acceptance_window_minutes INTEGER NOT NULL DEFAULT 30,
  acceptance_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Reallocation details
  reallocation_reason TEXT,
  reallocated_by UUID REFERENCES auth.users(id),
  reallocated_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- CAPACITY TRACKING
-- =====================================================

CREATE TABLE public.capacity_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_partner_id UUID NOT NULL REFERENCES public.gig_partners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Capacity settings for the day
  max_daily_capacity INTEGER NOT NULL,
  initial_capacity_available INTEGER NOT NULL,
  
  -- Real-time tracking
  current_capacity_available INTEGER NOT NULL,
  cases_allocated INTEGER NOT NULL DEFAULT 0,
  cases_accepted INTEGER NOT NULL DEFAULT 0,
  cases_in_progress INTEGER NOT NULL DEFAULT 0,
  cases_submitted INTEGER NOT NULL DEFAULT 0,
  cases_completed INTEGER NOT NULL DEFAULT 0,
  
  -- Capacity consumption/freeing events
  last_capacity_consumed_at TIMESTAMP WITH TIME ZONE,
  last_capacity_freed_at TIMESTAMP WITH TIME ZONE,
  
  -- Reset tracking
  last_reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reset_count INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one record per gig per day
  UNIQUE(gig_partner_id, date)
);

-- =====================================================
-- PERFORMANCE METRICS
-- =====================================================

CREATE TABLE public.performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_partner_id UUID NOT NULL REFERENCES public.gig_partners(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id),
  
  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Case counts
  total_cases_assigned INTEGER NOT NULL DEFAULT 0,
  total_cases_accepted INTEGER NOT NULL DEFAULT 0,
  total_cases_completed INTEGER NOT NULL DEFAULT 0,
  total_cases_on_time INTEGER NOT NULL DEFAULT 0,
  total_cases_qc_passed INTEGER NOT NULL DEFAULT 0,
  total_cases_qc_rejected INTEGER NOT NULL DEFAULT 0,
  
  -- Calculated rates (stored for performance)
  completion_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  ontime_completion_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  acceptance_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  quality_score DECIMAL(5,4) NOT NULL DEFAULT 0.0000, -- QC pass rate
  
  -- Response times (in minutes)
  avg_acceptance_time_minutes DECIMAL(8,2),
  avg_completion_time_hours DECIMAL(8,2),
  
  -- Last updated
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one record per gig per period
  UNIQUE(gig_partner_id, period_start, period_end)
);

-- =====================================================
-- ALLOCATION CONFIGURATION
-- =====================================================

CREATE TABLE public.allocation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default allocation configuration
-- First, get the admin user ID or use a fallback
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
  
  -- Insert configuration only if we have a valid user ID
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.allocation_config (config_key, config_value, description, updated_by) VALUES
    ('scoring_weights', '{"quality_score": 0.35, "completion_rate": 0.25, "ontime_completion_rate": 0.25, "acceptance_rate": 0.15}', 'Weights for allocation scoring algorithm', admin_user_id),
    ('acceptance_window', '{"minutes": 30, "nudge_after_minutes": 15, "max_waves": 3}', 'Acceptance window and reallocation settings', admin_user_id),
    ('capacity_rules', '{"consume_on": "accepted", "free_on": "submitted", "reset_time": "06:00", "max_daily_capacity": 10}', 'Capacity consumption and freeing rules', admin_user_id),
    ('quality_thresholds', '{"min_quality_score": 0.85, "min_completion_rate": 0.80, "min_acceptance_rate": 0.70}', 'Minimum thresholds for allocation eligibility', admin_user_id);
  END IF;
END $$;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Allocation logs indexes
CREATE INDEX idx_allocation_logs_case_id ON public.allocation_logs(case_id);
CREATE INDEX idx_allocation_logs_candidate_id ON public.allocation_logs(candidate_id);
CREATE INDEX idx_allocation_logs_allocated_at ON public.allocation_logs(allocated_at);
CREATE INDEX idx_allocation_logs_decision ON public.allocation_logs(decision);
CREATE INDEX idx_allocation_logs_wave ON public.allocation_logs(wave_number);

-- Capacity tracking indexes
CREATE INDEX idx_capacity_tracking_gig_partner ON public.capacity_tracking(gig_partner_id);
CREATE INDEX idx_capacity_tracking_date ON public.capacity_tracking(date);
CREATE INDEX idx_capacity_tracking_available ON public.capacity_tracking(current_capacity_available);
CREATE INDEX idx_capacity_tracking_active ON public.capacity_tracking(is_active);

-- Performance metrics indexes
CREATE INDEX idx_performance_metrics_gig_partner ON public.performance_metrics(gig_partner_id);
CREATE INDEX idx_performance_metrics_vendor ON public.performance_metrics(vendor_id);
CREATE INDEX idx_performance_metrics_period ON public.performance_metrics(period_start, period_end);
CREATE INDEX idx_performance_metrics_quality ON public.performance_metrics(quality_score);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.allocation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_config ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ALLOCATION ENGINE FUNCTIONS
-- =====================================================

-- Function to get allocation candidates for a case
CREATE OR REPLACE FUNCTION public.get_allocation_candidates(
  p_case_id UUID,
  p_pincode TEXT,
  p_pincode_tier pincode_tier
)
RETURNS TABLE (
  gig_partner_id UUID,
  vendor_id UUID,
  assignment_type assignment_type,
  quality_score DECIMAL(5,4),
  completion_rate DECIMAL(5,4),
  ontime_completion_rate DECIMAL(5,4),
  acceptance_rate DECIMAL(5,4),
  final_score DECIMAL(5,4),
  distance_km DECIMAL(8,2),
  capacity_available INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gp.id as gig_partner_id,
    gp.vendor_id,
    CASE 
      WHEN gp.vendor_id IS NOT NULL THEN 'vendor'::assignment_type
      ELSE 'gig'::assignment_type
    END as assignment_type,
    COALESCE(pm.quality_score, 0.0000) as quality_score,
    COALESCE(pm.completion_rate, 0.0000) as completion_rate,
    COALESCE(pm.ontime_completion_rate, 0.0000) as ontime_completion_rate,
    COALESCE(pm.acceptance_rate, 0.0000) as acceptance_rate,
    0.0000 as final_score, -- Will be calculated in application
    0.00 as distance_km, -- Will be calculated in application
    gp.capacity_available
  FROM public.gig_partners gp
  LEFT JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
    AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
  WHERE gp.is_active = true 
    AND gp.is_available = true
    AND gp.capacity_available > 0
    AND p_pincode = ANY(gp.coverage_pincodes)
  ORDER BY 
    COALESCE(pm.quality_score, 0.0000) DESC,
    COALESCE(pm.completion_rate, 0.0000) DESC,
    COALESCE(pm.ontime_completion_rate, 0.0000) DESC,
    COALESCE(pm.acceptance_rate, 0.0000) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to consume capacity
CREATE OR REPLACE FUNCTION public.consume_capacity(
  p_gig_partner_id UUID,
  p_case_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_capacity INTEGER;
  max_capacity INTEGER;
BEGIN
  -- Get current capacity
  SELECT capacity_available, max_daily_capacity 
  INTO current_capacity, max_capacity
  FROM public.gig_partners 
  WHERE id = p_gig_partner_id AND is_active = true;
  
  -- Check if capacity is available
  IF current_capacity <= 0 THEN
    RETURN false;
  END IF;
  
  -- Consume capacity
  UPDATE public.gig_partners 
  SET 
    capacity_available = capacity_available - 1,
    active_cases_count = active_cases_count + 1,
    updated_at = now()
  WHERE id = p_gig_partner_id;
  
  -- Update capacity tracking
  INSERT INTO public.capacity_tracking (
    gig_partner_id, 
    date, 
    max_daily_capacity, 
    initial_capacity_available,
    current_capacity_available,
    cases_allocated
  ) VALUES (
    p_gig_partner_id,
    CURRENT_DATE,
    max_capacity,
    current_capacity,
    current_capacity - 1,
    1
  ) ON CONFLICT (gig_partner_id, date) 
  DO UPDATE SET
    current_capacity_available = capacity_tracking.current_capacity_available - 1,
    cases_allocated = capacity_tracking.cases_allocated + 1,
    last_capacity_consumed_at = now(),
    updated_at = now();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to free capacity
CREATE OR REPLACE FUNCTION public.free_capacity(
  p_gig_partner_id UUID,
  p_case_id UUID
)
RETURNS VOID AS $$
DECLARE
  current_capacity INTEGER;
  max_capacity INTEGER;
BEGIN
  -- Get current capacity
  SELECT capacity_available, max_daily_capacity 
  INTO current_capacity, max_capacity
  FROM public.gig_partners 
  WHERE id = p_gig_partner_id;
  
  -- Free capacity
  UPDATE public.gig_partners 
  SET 
    capacity_available = LEAST(capacity_available + 1, max_daily_capacity),
    active_cases_count = GREATEST(active_cases_count - 1, 0),
    updated_at = now()
  WHERE id = p_gig_partner_id;
  
  -- Update capacity tracking
  UPDATE public.capacity_tracking 
  SET 
    current_capacity_available = LEAST(current_capacity_available + 1, max_daily_capacity),
    last_capacity_freed_at = now(),
    updated_at = now()
  WHERE gig_partner_id = p_gig_partner_id AND date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily capacity
CREATE OR REPLACE FUNCTION public.reset_daily_capacity()
RETURNS VOID AS $$
BEGIN
  -- Reset all gig partners' capacity
  UPDATE public.gig_partners 
  SET 
    capacity_available = max_daily_capacity,
    active_cases_count = 0,
    last_capacity_reset = now(),
    updated_at = now()
  WHERE is_active = true;
  
  -- Create new capacity tracking records for today
  INSERT INTO public.capacity_tracking (
    gig_partner_id,
    date,
    max_daily_capacity,
    initial_capacity_available,
    current_capacity_available,
    last_reset_at,
    reset_count
  )
  SELECT 
    id,
    CURRENT_DATE,
    max_daily_capacity,
    max_daily_capacity,
    max_daily_capacity,
    now(),
    COALESCE(ct.reset_count + 1, 1)
  FROM public.gig_partners gp
  LEFT JOIN public.capacity_tracking ct ON gp.id = ct.gig_partner_id 
    AND ct.date = CURRENT_DATE - INTERVAL '1 day'
  WHERE gp.is_active = true
  ON CONFLICT (gig_partner_id, date) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to update performance metrics
CREATE OR REPLACE FUNCTION public.update_performance_metrics(
  p_gig_partner_id UUID,
  p_period_days INTEGER DEFAULT 30
)
RETURNS VOID AS $$
DECLARE
  period_start DATE;
  period_end DATE;
  metrics RECORD;
BEGIN
  period_end := CURRENT_DATE;
  period_start := period_end - INTERVAL '1 day' * p_period_days;
  
  -- Calculate metrics for the period
  SELECT 
    COUNT(*) as total_cases_assigned,
    COUNT(CASE WHEN c.status IN ('accepted', 'in_progress', 'submitted', 'qc_pending', 'qc_passed', 'qc_rejected', 'qc_rework', 'completed', 'reported', 'in_payment_cycle') THEN 1 END) as total_cases_accepted,
    COUNT(CASE WHEN c.status IN ('completed', 'reported', 'in_payment_cycle') THEN 1 END) as total_cases_completed,
    COUNT(CASE WHEN c.status IN ('completed', 'reported', 'in_payment_cycle') AND c.completed_at <= c.due_at THEN 1 END) as total_cases_on_time,
    COUNT(CASE WHEN c.status = 'qc_passed' THEN 1 END) as total_cases_qc_passed,
    COUNT(CASE WHEN c.status = 'qc_rejected' THEN 1 END) as total_cases_qc_rejected
  INTO metrics
  FROM public.cases c
  WHERE c.current_assignee_id = p_gig_partner_id
    AND c.created_at >= period_start
    AND c.created_at <= period_end;
  
  -- Insert or update performance metrics
  INSERT INTO public.performance_metrics (
    gig_partner_id,
    period_start,
    period_end,
    total_cases_assigned,
    total_cases_accepted,
    total_cases_completed,
    total_cases_on_time,
    total_cases_qc_passed,
    total_cases_qc_rejected,
    completion_rate,
    ontime_completion_rate,
    acceptance_rate,
    quality_score
  ) VALUES (
    p_gig_partner_id,
    period_start,
    period_end,
    COALESCE(metrics.total_cases_assigned, 0),
    COALESCE(metrics.total_cases_accepted, 0),
    COALESCE(metrics.total_cases_completed, 0),
    COALESCE(metrics.total_cases_on_time, 0),
    COALESCE(metrics.total_cases_qc_passed, 0),
    COALESCE(metrics.total_cases_qc_rejected, 0),
    CASE WHEN metrics.total_cases_assigned > 0 THEN COALESCE(metrics.total_cases_completed, 0)::DECIMAL / metrics.total_cases_assigned ELSE 0 END,
    CASE WHEN metrics.total_cases_completed > 0 THEN COALESCE(metrics.total_cases_on_time, 0)::DECIMAL / metrics.total_cases_completed ELSE 0 END,
    CASE WHEN metrics.total_cases_assigned > 0 THEN COALESCE(metrics.total_cases_accepted, 0)::DECIMAL / metrics.total_cases_assigned ELSE 0 END,
    CASE WHEN (COALESCE(metrics.total_cases_qc_passed, 0) + COALESCE(metrics.total_cases_qc_rejected, 0)) > 0 
         THEN COALESCE(metrics.total_cases_qc_passed, 0)::DECIMAL / (COALESCE(metrics.total_cases_qc_passed, 0) + COALESCE(metrics.total_cases_qc_rejected, 0))
         ELSE 0 END
  )
  ON CONFLICT (gig_partner_id, period_start, period_end)
  DO UPDATE SET
    total_cases_assigned = EXCLUDED.total_cases_assigned,
    total_cases_accepted = EXCLUDED.total_cases_accepted,
    total_cases_completed = EXCLUDED.total_cases_completed,
    total_cases_on_time = EXCLUDED.total_cases_on_time,
    total_cases_qc_passed = EXCLUDED.total_cases_qc_passed,
    total_cases_qc_rejected = EXCLUDED.total_cases_qc_rejected,
    completion_rate = EXCLUDED.completion_rate,
    ontime_completion_rate = EXCLUDED.ontime_completion_rate,
    acceptance_rate = EXCLUDED.acceptance_rate,
    quality_score = EXCLUDED.quality_score,
    last_updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger to update capacity when case status changes
CREATE OR REPLACE FUNCTION public.handle_case_status_change()
RETURNS TRIGGER AS $$
DECLARE
  capacity_config JSONB;
  consume_on TEXT;
  free_on TEXT;
BEGIN
  -- Get capacity configuration
  SELECT config_value INTO capacity_config
  FROM public.allocation_config 
  WHERE config_key = 'capacity_rules';
  
  consume_on := capacity_config->>'consume_on';
  free_on := capacity_config->>'free_on';
  
  -- Consume capacity when case is accepted
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    PERFORM public.consume_capacity(NEW.current_assignee_id, NEW.id);
  END IF;
  
  -- Free capacity when case moves to configured state
  IF NEW.status::TEXT = free_on AND OLD.status::TEXT != free_on THEN
    PERFORM public.free_capacity(NEW.current_assignee_id, NEW.id);
  END IF;
  
  -- Update performance metrics when case is completed
  IF NEW.status IN ('completed', 'reported', 'in_payment_cycle') AND OLD.status NOT IN ('completed', 'reported', 'in_payment_cycle') THEN
    PERFORM public.update_performance_metrics(NEW.current_assignee_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_case_status_change_trigger
  AFTER UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_case_status_change();

-- =====================================================
-- SCHEDULED JOBS (using pg_cron if available)
-- =====================================================

-- Note: These would be set up as cron jobs in production
-- Daily capacity reset at 6 AM
-- SELECT cron.schedule('daily-capacity-reset', '0 6 * * *', 'SELECT public.reset_daily_capacity();');

-- Update performance metrics every 6 hours
-- SELECT cron.schedule('update-performance-metrics', '0 */6 * * *', 'SELECT public.update_performance_metrics(gp.id) FROM public.gig_partners gp WHERE gp.is_active = true;');
