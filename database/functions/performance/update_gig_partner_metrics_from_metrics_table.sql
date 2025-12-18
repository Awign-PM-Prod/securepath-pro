-- =====================================================
-- Update Gig Partner Performance Metrics from Metrics Table
-- Background Verification Platform
-- =====================================================
-- This function calculates and updates the 4 performance metrics
-- in gig_partners table based on values from gig_worker_metrics table
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_gig_partner_metrics_from_metrics_table()
RETURNS TABLE (
  updated_count INTEGER,
  avg_acceptance_rate DECIMAL(5,4),
  avg_completion_rate DECIMAL(5,4),
  avg_ontime_completion_rate DECIMAL(5,4),
  avg_quality_score DECIMAL(5,4)
) AS $$
DECLARE
  updated_count_var INTEGER;
  avg_acceptance_rate_var DECIMAL(5,4);
  avg_completion_rate_var DECIMAL(5,4);
  avg_ontime_completion_rate_var DECIMAL(5,4);
  avg_quality_score_var DECIMAL(5,4);
BEGIN
  -- Update gig_partners with metrics calculated from gig_worker_metrics
  WITH ontime_stats AS (
    -- Calculate on-time completion count per worker
    SELECT 
      c.current_assignee_id as gig_worker_id,
      COUNT(CASE 
        WHEN c.status IN ('submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'in_payment_cycle', 'payment_complete')
          AND c.submitted_at IS NOT NULL
          AND al.accepted_at IS NOT NULL
          AND c.submitted_at <= (al.accepted_at + (c.tat_hours || ' hours')::INTERVAL)
        THEN 1 
      END) as cases_on_time
    FROM public.cases c
    LEFT JOIN public.allocation_logs al ON al.case_id = c.id 
      AND al.candidate_id = c.current_assignee_id
      AND al.candidate_type = 'gig'
      AND (al.decision = 'accepted' OR al.accepted_at IS NOT NULL)
    WHERE c.current_assignee_type = 'gig'
      AND c.current_assignee_id IS NOT NULL
    GROUP BY c.current_assignee_id
  ),
  metrics_calc AS (
    SELECT 
      gwm.gig_worker_id,
      -- Acceptance Rate: (Cases Accepted) / (Cases Allocated)
      CASE 
        WHEN gwm.cases_allocated_count > 0 
        THEN LEAST(gwm.cases_accepted_count::DECIMAL / gwm.cases_allocated_count::DECIMAL, 1.00)
        ELSE 0.00
      END::DECIMAL(3,2) as acceptance_rate,
      
      -- Completion Rate: (Cases Submitted) / (Cases Accepted)
      CASE 
        WHEN gwm.cases_accepted_count > 0 
        THEN LEAST(gwm.cases_submitted_count::DECIMAL / gwm.cases_accepted_count::DECIMAL, 1.00)
        ELSE 0.00
      END::DECIMAL(3,2) as completion_rate,
      
      -- On-Time Completion Rate: (Cases On-Time) / (Cases Accepted)
      CASE 
        WHEN gwm.cases_accepted_count > 0 
        THEN LEAST(COALESCE(ots.cases_on_time, 0)::DECIMAL / gwm.cases_accepted_count::DECIMAL, 1.00)
        ELSE 0.00
      END::DECIMAL(3,2) as ontime_completion_rate,
      
      -- Quality Score: (Cases QC Passed) / (Cases Submitted)
      CASE 
        WHEN gwm.cases_submitted_count > 0 
        THEN LEAST(gwm.cases_qc_passed_count::DECIMAL / gwm.cases_submitted_count::DECIMAL, 1.00)
        ELSE 0.00
      END::DECIMAL(3,2) as quality_score
    FROM public.gig_worker_metrics gwm
    LEFT JOIN ontime_stats ots ON ots.gig_worker_id = gwm.gig_worker_id
  )
  UPDATE public.gig_partners gp
  SET 
    acceptance_rate = mc.acceptance_rate,
    completion_rate = mc.completion_rate,
    ontime_completion_rate = mc.ontime_completion_rate,
    quality_score = mc.quality_score,
    updated_at = now()
  FROM metrics_calc mc
  WHERE gp.id = mc.gig_worker_id
    AND gp.is_active = true;
  
  GET DIAGNOSTICS updated_count_var = ROW_COUNT;
  
  -- Calculate averages for return
  SELECT 
    ROUND(AVG(acceptance_rate), 4),
    ROUND(AVG(completion_rate), 4),
    ROUND(AVG(ontime_completion_rate), 4),
    ROUND(AVG(quality_score), 4)
  INTO 
    avg_acceptance_rate_var,
    avg_completion_rate_var,
    avg_ontime_completion_rate_var,
    avg_quality_score_var
  FROM public.gig_partners
  WHERE is_active = true;
  
  RETURN QUERY SELECT 
    updated_count_var,
    avg_acceptance_rate_var,
    avg_completion_rate_var,
    avg_ontime_completion_rate_var,
    avg_quality_score_var;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_gig_partner_metrics_from_metrics_table() TO authenticated;

-- Note: On-Time Completion Rate calculation needs to be enhanced
-- Currently it uses the same calculation as completion_rate
-- You may need to add a column to track on-time submissions or calculate it differently

