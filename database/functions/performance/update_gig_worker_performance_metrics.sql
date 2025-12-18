-- =====================================================
-- Updatle Gig Worker Performance Metrics
-- Background Verification Platform
-- =====================================================
-- This script recalculates and updates performance metrics for all gig workers
-- based on the new calculation formulas:
--
-- 1. Acceptance Rate: (Cases Accepted) / (Cases Allocated)
-- 2. On-Time Rate: (Cases Submitted Within TAT) / (Cases Accepted)
-- 3. Completion Rate: (Cases Submitted) / (Cases Accepted)
-- 4. Quality Score: (QC Passed Cases) / (Cases Submitted)
-- =====================================================

WITH allocated_cases AS (
  -- Get all cases that were allocated to each gig worker (from allocation_logs)
  SELECT DISTINCT
    al.candidate_id as gig_partner_id,
    al.case_id
  FROM public.allocation_logs al
  WHERE al.candidate_type = 'gig'
    AND al.decision IN ('allocated', 'accepted')
),
case_metrics AS (
  SELECT 
    c.current_assignee_id as gig_partner_id,
    c.id as case_id,
    c.status,
    c.tat_hours,
    -- Get accepted_at from allocation_logs
    (SELECT al.accepted_at 
     FROM allocation_logs al 
     WHERE al.case_id = c.id 
       AND al.candidate_id = c.current_assignee_id 
       AND al.decision = 'accepted'
     ORDER BY al.accepted_at DESC 
     LIMIT 1) as accepted_at,
    -- Get submitted_at from cases or form_submissions
    COALESCE(
      c.submitted_at,
      (SELECT fs.submitted_at 
       FROM form_submissions fs 
       WHERE fs.case_id = c.id 
       ORDER BY fs.submitted_at DESC 
       LIMIT 1)
    ) as submitted_at
  FROM public.cases c
  WHERE c.current_assignee_type = 'gig'
    AND c.is_active = true
    AND c.current_assignee_id IS NOT NULL
),
worker_stats AS (
  SELECT 
    gp.id as gig_partner_id,
    
    -- Count allocated cases (from allocation_logs, regardless of current status)
    COUNT(DISTINCT ac.case_id) as cases_allocated,
    
    -- Count accepted cases (status is accepted or beyond)
    COUNT(CASE WHEN cm.status IN ('accepted', 'in_progress', 'submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'completed', 'in_payment_cydincle', 'payment_complete') THEN 1 END) as cases_accepted,
    
    -- Count submitted cases
    COUNT(CASE WHEN cm.status IN ('submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'completed', 'in_payment_cycle', 'payment_complete') THEN 1 END) as cases_submitted,
    
    -- Count on-time submissions (submitted within TAT from acceptance)
    COUNT(CASE 
      WHEN cm.status IN ('submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'completed', 'in_payment_cycle', 'payment_complete')
      AND cm.submitted_at IS NOT NULL
      AND cm.accepted_at IS NOT NULL
      AND cm.submitted_at <= (cm.accepted_at + (cm.tat_hours || ' hours')::INTERVAL)
      THEN 1 
    END) as cases_on_time,
    
    -- Count QC passed cases
    COUNT(CASE WHEN cm.status = 'qc_passed' THEN 1 END) as cases_qc_passed
    
  FROM public.gig_partners gp
  LEFT JOIN allocated_cases ac ON ac.gig_partner_id = gp.id
  LEFT JOIN case_metrics cm ON cm.gig_partner_id = gp.id
  WHERE gp.is_active = true
  GROUP BY gp.id
)
UPDATE public.gig_partners gp
SET 
  -- Acceptance Rate: (Cases Accepted) / (Cases Allocated)
  -- Cap at 1.00 first, then cast to DECIMAL(3,2) to prevent overflow
  acceptance_rate = (LEAST(
    CASE 
      WHEN ws.cases_allocated > 0 
      THEN ws.cases_accepted::DECIMAL / ws.cases_allocated::DECIMAL
      ELSE 0.00
    END,
    1.00
  ))::DECIMAL(3,2),
  
  -- On-Time Rate: (Cases Submitted Within TAT) / (Cases Accepted)
  ontime_completion_rate = (LEAST(
    CASE 
      WHEN ws.cases_accepted > 0 
      THEN ws.cases_on_time::DECIMAL / ws.cases_accepted::DECIMAL
      ELSE 0.00
    END,
    1.00
  ))::DECIMAL(3,2),
  
  -- Completion Rate: (Cases Submitted) / (Cases Accepted)
  completion_rate = (LEAST(
    CASE 
      WHEN ws.cases_accepted > 0 
      THEN ws.cases_submitted::DECIMAL / ws.cases_accepted::DECIMAL
      ELSE 0.00
    END,
    1.00
  ))::DECIMAL(3,2),
  
  -- Quality Score: (QC Passed Cases) / (Cases Submitted)
  quality_score = (LEAST(
    CASE 
      WHEN ws.cases_submitted > 0 
      THEN ws.cases_qc_passed::DECIMAL / ws.cases_submitted::DECIMAL
      ELSE 0.00
    END,
    1.00
  ))::DECIMAL(3,2),
  
  updated_at = now()
FROM worker_stats ws
WHERE gp.id = ws.gig_partner_id;

-- Show summary of updated metrics
SELECT 
  'Performance Metrics Updated' as info,
  COUNT(*) as total_gig_workers_updated,
  ROUND(AVG(acceptance_rate) * 100, 2) as avg_acceptance_rate_pct,
  ROUND(AVG(ontime_completion_rate) * 100, 2) as avg_ontime_rate_pct,
  ROUND(AVG(completion_rate) * 100, 2) as avg_completion_rate_pct,
  ROUND(AVG(quality_score) * 100, 2) as avg_quality_score_pct
FROM public.gig_partners
WHERE is_active = true;

-- Show sample of updated workers
SELECT 
  'Sample Updated Workers' as info,
  p.first_name || ' ' || p.last_name as worker_name,
  ROUND(gp.acceptance_rate * 100, 2) as acceptance_rate_pct,
  ROUND(gp.ontime_completion_rate * 100, 2) as ontime_rate_pct,
  ROUND(gp.completion_rate * 100, 2) as completion_rate_pct,
  ROUND(gp.quality_score * 100, 2) as quality_score_pct
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
ORDER BY gp.quality_score DESC, gp.completion_rate DESC
LIMIT 10;
