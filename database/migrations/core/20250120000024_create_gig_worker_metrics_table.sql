-- =====================================================
-- Create Gig Worker Metrics Table
-- Background Verification Platform
-- =====================================================
-- This table tracks cumulative metrics for each gig worker
-- to automate performance calculations and total_score updates
-- =====================================================

-- Create the gig_worker_metrics table
CREATE TABLE IF NOT EXISTS public.gig_worker_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_worker_id UUID NOT NULL UNIQUE REFERENCES public.gig_partners(id) ON DELETE CASCADE,
  gig_worker_name TEXT NOT NULL,
  
  -- Case counts (cumulative, all-time)
  cases_allocated_count INTEGER NOT NULL DEFAULT 0,
  cases_accepted_count INTEGER NOT NULL DEFAULT 0,
  cases_submitted_count INTEGER NOT NULL DEFAULT 0,
  cases_qc_passed_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Indexes for performance
  CONSTRAINT gig_worker_metrics_gig_worker_id_key UNIQUE (gig_worker_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gig_worker_metrics_gig_worker_id ON public.gig_worker_metrics(gig_worker_id);
CREATE INDEX IF NOT EXISTS idx_gig_worker_metrics_last_updated ON public.gig_worker_metrics(last_updated_at);

-- Add comments
COMMENT ON TABLE public.gig_worker_metrics IS 'Cumulative metrics for gig workers to track performance and calculate total_score';
COMMENT ON COLUMN public.gig_worker_metrics.cases_allocated_count IS 'Total number of cases ever allocated to this gig worker';
COMMENT ON COLUMN public.gig_worker_metrics.cases_accepted_count IS 'Total number of cases accepted by this gig worker';
COMMENT ON COLUMN public.gig_worker_metrics.cases_submitted_count IS 'Total number of cases in submitted status and beyond (submitted, qc_passed, qc_rejected, qc_rework, reported, in_payment_cycle, payment_complete)';
COMMENT ON COLUMN public.gig_worker_metrics.cases_qc_passed_count IS 'Total number of cases that passed QC for this gig worker';

-- =====================================================
-- Populate the table with current data
-- =====================================================

-- Insert or update metrics for all active gig workers
INSERT INTO public.gig_worker_metrics (
  gig_worker_id,
  gig_worker_name,
  cases_allocated_count,
  cases_accepted_count,
  cases_submitted_count,
  cases_qc_passed_count,
  last_updated_at,
  created_at
)
SELECT 
  gp.id as gig_worker_id,
  CONCAT(p.first_name, ' ', p.last_name) as gig_worker_name,
  
  -- Cases allocated: Count all allocation_logs for this gig worker
  COALESCE(
    (SELECT COUNT(DISTINCT al.case_id)
     FROM public.allocation_logs al
     WHERE al.candidate_id = gp.id
       AND al.candidate_type = 'gig'
       AND al.allocated_at IS NOT NULL),
    0
  ) as cases_allocated_count,
  
  -- Cases accepted: Count allocation_logs where decision = 'accepted' or accepted_at is not null
  COALESCE(
    (SELECT COUNT(DISTINCT al.case_id)
     FROM public.allocation_logs al
     WHERE al.candidate_id = gp.id
       AND al.candidate_type = 'gig'
       AND (al.decision = 'accepted' OR al.accepted_at IS NOT NULL)),
    0
  ) as cases_accepted_count,
  
  -- Cases submitted: Count cases where status is 'submitted' or any status beyond (qc_passed, qc_rejected, qc_rework, reported, in_payment_cycle, payment_complete)
  COALESCE(
    (SELECT COUNT(*)
     FROM public.cases c
     WHERE c.current_assignee_id = gp.id
       AND c.current_assignee_type = 'gig'
       AND c.status IN ('submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'in_payment_cycle', 'payment_complete')),
    0
  ) as cases_submitted_count,
  
  -- Cases QC passed: Count cases where status = 'qc_passed' and current_assignee_id = gig_worker_id
  COALESCE(
    (SELECT COUNT(*)
     FROM public.cases c
     WHERE c.current_assignee_id = gp.id
       AND c.current_assignee_type = 'gig'
       AND c.status = 'qc_passed'),
    0
  ) as cases_qc_passed_count,
  
  now() as last_updated_at,
  now() as created_at

FROM public.gig_partners gp
LEFT JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
ON CONFLICT (gig_worker_id) 
DO UPDATE SET
  gig_worker_name = EXCLUDED.gig_worker_name,
  cases_allocated_count = EXCLUDED.cases_allocated_count,
  cases_accepted_count = EXCLUDED.cases_accepted_count,
  cases_submitted_count = EXCLUDED.cases_submitted_count,
  cases_qc_passed_count = EXCLUDED.cases_qc_passed_count,
  last_updated_at = EXCLUDED.last_updated_at;

-- Show summary of populated data
SELECT 
  'Gig Worker Metrics Table Created' as info,
  COUNT(*) as total_gig_workers,
  SUM(cases_allocated_count) as total_allocations,
  SUM(cases_accepted_count) as total_acceptances,
  SUM(cases_submitted_count) as total_submissions,
  SUM(cases_qc_passed_count) as total_qc_passed
FROM public.gig_worker_metrics;

-- Show sample of populated data
SELECT 
  gig_worker_name,
  cases_allocated_count,
  cases_accepted_count,
  cases_submitted_count,
  cases_qc_passed_count,
  last_updated_at
FROM public.gig_worker_metrics
ORDER BY cases_allocated_count DESC
LIMIT 10;

