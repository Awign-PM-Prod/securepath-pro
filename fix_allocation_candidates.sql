-- =====================================================
-- Fix Allocation Candidates Function
-- =====================================================

-- This script fixes the get_allocation_candidates function to properly handle
-- workers without performance data by excluding them instead of giving them 0% scores

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
    pm.quality_score,
    pm.completion_rate,
    pm.ontime_completion_rate,
    pm.acceptance_rate,
    0.0000 as final_score, -- Will be calculated in application
    0.00 as distance_km, -- Will be calculated in application
    gp.capacity_available
  FROM public.gig_partners gp
  INNER JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
    AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
  WHERE gp.is_active = true 
    AND gp.is_available = true
    AND gp.capacity_available > 0
    AND p_pincode = ANY(gp.coverage_pincodes)
    -- Only include workers with actual performance data
    AND pm.quality_score IS NOT NULL
    AND pm.completion_rate IS NOT NULL
    AND pm.ontime_completion_rate IS NOT NULL
    AND pm.acceptance_rate IS NOT NULL
  ORDER BY 
    pm.quality_score DESC,
    pm.completion_rate DESC,
    pm.ontime_completion_rate DESC,
    pm.acceptance_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Test the function to see which workers have performance data
SELECT 
  'Workers with Performance Data' as info,
  gp.id,
  p.first_name || ' ' || p.last_name as name,
  pm.quality_score,
  pm.completion_rate,
  pm.ontime_completion_rate,
  pm.acceptance_rate,
  gp.capacity_available
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
  AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
WHERE gp.is_active = true
ORDER BY pm.quality_score DESC NULLS LAST;

-- Show workers without performance data
SELECT 
  'Workers WITHOUT Performance Data' as info,
  gp.id,
  p.first_name || ' ' || p.last_name as name,
  gp.capacity_available,
  'No performance metrics found' as reason
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
LEFT JOIN public.performance_metrics pm ON gp.id = pm.gig_partner_id 
  AND (pm.period_end >= CURRENT_DATE - INTERVAL '30 days' OR pm.period_end IS NULL)
WHERE gp.is_active = true
  AND pm.id IS NULL
ORDER BY p.first_name;
