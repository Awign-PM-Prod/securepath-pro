-- =====================================================
-- Update Total Score for All Gig Workers
-- Calculates total_score based on scoring weights from allocation_config
-- Background Verification Platform
-- =====================================================

-- This query calculates total_score for each gig worker using the formula:
-- total_score = (quality_score * weight_quality) + 
--               (completion_rate * weight_completion) + 
--               (ontime_completion_rate * weight_ontime) + 
--               (acceptance_rate * weight_acceptance)
--
-- Where weights come from allocation_config table (config_key = 'scoring_weights')

-- First, update gig_partner metrics from gig_worker_metrics table
-- (This calculation is done inline - you can also use the function update_gig_partner_metrics_from_metrics_table() if it exists)
DO $$
BEGIN
  -- Update metrics from gig_worker_metrics table
  WITH ontime_stats AS (
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
      CASE 
        WHEN gwm.cases_allocated_count > 0 
        THEN LEAST(gwm.cases_accepted_count::DECIMAL / gwm.cases_allocated_count::DECIMAL, 1.00)
        ELSE 0.00
      END::DECIMAL(3,2) as acceptance_rate,
      CASE 
        WHEN gwm.cases_accepted_count > 0 
        THEN LEAST(gwm.cases_submitted_count::DECIMAL / gwm.cases_accepted_count::DECIMAL, 1.00)
        ELSE 0.00
      END::DECIMAL(3,2) as completion_rate,
      CASE 
        WHEN gwm.cases_accepted_count > 0 
        THEN LEAST(COALESCE(ots.cases_on_time, 0)::DECIMAL / gwm.cases_accepted_count::DECIMAL, 1.00)
        ELSE 0.00
      END::DECIMAL(3,2) as ontime_completion_rate,
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
END $$;

-- Then, check if scoring weights configuration exists and update total_score
DO $$
DECLARE
  config_exists BOOLEAN;
  weights_record RECORD;
BEGIN
  -- Check if configuration exists
  SELECT EXISTS(
    SELECT 1 
    FROM public.allocation_config 
    WHERE config_key = 'scoring_weights' 
      AND is_active = true
  ) INTO config_exists;

  IF NOT config_exists THEN
    RAISE EXCEPTION 'Scoring weights configuration not found in allocation_config table. Please configure scoring weights in the Configuration tab first.';
  END IF;

  -- Get the weights
  SELECT 
    (config_value->>'quality_score')::DECIMAL(3,2) as weight_quality_score,
    (config_value->>'completion_rate')::DECIMAL(3,2) as weight_completion_rate,
    (config_value->>'ontime_completion_rate')::DECIMAL(3,2) as weight_ontime_completion_rate,
    (config_value->>'acceptance_rate')::DECIMAL(3,2) as weight_acceptance_rate
  INTO weights_record
  FROM public.allocation_config
  WHERE config_key = 'scoring_weights'
    AND is_active = true
  LIMIT 1;

  -- Validate weights are not null
  IF weights_record.weight_quality_score IS NULL 
     OR weights_record.weight_completion_rate IS NULL 
     OR weights_record.weight_ontime_completion_rate IS NULL 
     OR weights_record.weight_acceptance_rate IS NULL THEN
    RAISE EXCEPTION 'One or more scoring weights are missing in the configuration. Please ensure all weights are set.';
  END IF;

  -- Update total_score for all gig workers
  UPDATE public.gig_partners
  SET 
    total_score = (
      LEAST(
        -- Calculate weighted sum
        COALESCE(quality_score, 0.00) * weights_record.weight_quality_score +
        COALESCE(completion_rate, 0.00) * weights_record.weight_completion_rate +
        COALESCE(ontime_completion_rate, 0.00) * weights_record.weight_ontime_completion_rate +
        COALESCE(acceptance_rate, 0.00) * weights_record.weight_acceptance_rate,
        1.00  -- Cap at 1.00
      )
    )::DECIMAL(3,2),
    updated_at = now();

  RAISE NOTICE 'Total scores updated successfully for all gig workers using weights: Quality=%, Completion=%, OnTime=%, Acceptance=%',
    weights_record.weight_quality_score * 100,
    weights_record.weight_completion_rate * 100,
    weights_record.weight_ontime_completion_rate * 100,
    weights_record.weight_acceptance_rate * 100;
END $$;

-- Show summary of updated total scores
SELECT 
  'Total Scores Updated' as info,
  COUNT(*) as total_gig_workers_updated,
  ROUND(AVG(total_score) * 100, 2) as avg_total_score_pct,
  ROUND(MIN(total_score) * 100, 2) as min_total_score_pct,
  ROUND(MAX(total_score) * 100, 2) as max_total_score_pct,
  COUNT(CASE WHEN total_score >= 0.80 THEN 1 END) as workers_above_80_pct,
  COUNT(CASE WHEN total_score >= 0.90 THEN 1 END) as workers_above_90_pct
FROM public.gig_partners
WHERE is_active = true;

-- Show sample of updated workers with their scores
SELECT 
  gp.id,
  CONCAT(p.first_name, ' ', p.last_name) as gig_worker_name,
  ROUND(gp.quality_score * 100, 2) as quality_score_pct,
  ROUND(gp.completion_rate * 100, 2) as completion_rate_pct,
  ROUND(gp.ontime_completion_rate * 100, 2) as ontime_rate_pct,
  ROUND(gp.acceptance_rate * 100, 2) as acceptance_rate_pct,
  ROUND(gp.total_score * 100, 2) as total_score_pct
FROM public.gig_partners gp
LEFT JOIN public.profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true
ORDER BY gp.total_score DESC
LIMIT 10;

-- Show the current scoring weights being used
SELECT 
  'Current Scoring Weights' as info,
  config_key,
  config_value,
  updated_at
FROM public.allocation_config
WHERE config_key = 'scoring_weights'
  AND is_active = true;

