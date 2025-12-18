-- =====================================================
-- Master Function: Update All Gig Worker Scores
-- Background Verification Platform
-- =====================================================
-- This function updates:
-- 1. Gig partner metrics from gig_worker_metrics table
-- 2. Total score based on allocation_config weights
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_all_gig_worker_scores()
RETURNS TABLE (
  metrics_updated INTEGER,
  total_scores_updated INTEGER,
  avg_total_score DECIMAL(5,4)
) AS $$
DECLARE
  metrics_updated_var INTEGER;
  total_scores_updated_var INTEGER;
  avg_total_score_var DECIMAL(5,4);
BEGIN
  -- Step 1: Update gig_partner metrics from gig_worker_metrics
  SELECT updated_count INTO metrics_updated_var
  FROM public.update_gig_partner_metrics_from_metrics_table();
  
  -- Step 2: Update total_score based on allocation_config
  WITH scoring_weights AS (
    SELECT 
      (config_value->>'quality_score')::DECIMAL(3,2) as weight_quality_score,
      (config_value->>'completion_rate')::DECIMAL(3,2) as weight_completion_rate,
      (config_value->>'ontime_completion_rate')::DECIMAL(3,2) as weight_ontime_completion_rate,
      (config_value->>'acceptance_rate')::DECIMAL(3,2) as weight_acceptance_rate
    FROM public.allocation_config
    WHERE config_key = 'scoring_weights'
      AND is_active = true
    LIMIT 1
  )
  UPDATE public.gig_partners gp
  SET 
    total_score = (
      LEAST(
        COALESCE(gp.quality_score, 0.00) * sw.weight_quality_score +
        COALESCE(gp.completion_rate, 0.00) * sw.weight_completion_rate +
        COALESCE(gp.ontime_completion_rate, 0.00) * sw.weight_ontime_completion_rate +
        COALESCE(gp.acceptance_rate, 0.00) * sw.weight_acceptance_rate,
        1.00
      )
    )::DECIMAL(3,2),
    updated_at = now()
  FROM scoring_weights sw
  WHERE sw.weight_quality_score IS NOT NULL
    AND gp.is_active = true;
  
  GET DIAGNOSTICS total_scores_updated_var = ROW_COUNT;
  
  -- Calculate average total score
  SELECT ROUND(AVG(total_score), 4) INTO avg_total_score_var
  FROM public.gig_partners
  WHERE is_active = true;
  
  RETURN QUERY SELECT 
    metrics_updated_var,
    total_scores_updated_var,
    avg_total_score_var;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_all_gig_worker_scores() TO authenticated;

