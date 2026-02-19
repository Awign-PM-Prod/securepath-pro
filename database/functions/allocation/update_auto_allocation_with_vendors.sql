-- =====================================================
-- Update Auto Allocation to Include Vendors
-- Background Verification Platform
-- =====================================================

-- Drop existing allocation function
DROP FUNCTION IF EXISTS public.get_allocation_candidates;

-- Create updated allocation function that considers vendors and direct assignment
CREATE OR REPLACE FUNCTION public.get_allocation_candidates_with_vendors(
  p_pincode TEXT,
  p_case_count INTEGER DEFAULT 1
)
RETURNS TABLE (
  candidate_id UUID,
  candidate_type TEXT, -- 'gig_worker' or 'vendor'
  name TEXT,
  email TEXT,
  phone TEXT,
  capacity_available INTEGER,
  performance_score DECIMAL,
  quality_score DECIMAL,
  completion_rate DECIMAL,
  ontime_completion_rate DECIMAL,
  acceptance_rate DECIMAL,
  distance_km DECIMAL,
  is_direct_gig BOOLEAN,
  vendor_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate_scores AS (
    -- Direct gig workers (is_direct_gig = true)
    SELECT 
      gp.id as candidate_id,
      'gig_worker'::TEXT as candidate_type,
      CONCAT(p.first_name, ' ', p.last_name) as name,
      p.email,
      gp.phone,
      gp.capacity_available,
      -- Performance score calculation
      (COALESCE(gp.completion_rate, 0) * 0.4 + 
       COALESCE(gp.ontime_completion_rate, 0) * 0.4 + 
       COALESCE(gp.acceptance_rate, 0) * 0.2) as performance_score,
      COALESCE(gp.quality_score, 0) as quality_score,
      COALESCE(gp.completion_rate, 0) as completion_rate,
      COALESCE(gp.ontime_completion_rate, 0) as ontime_completion_rate,
      COALESCE(gp.acceptance_rate, 0) as acceptance_rate,
      0::DECIMAL as distance_km, -- TODO: Calculate actual distance
      gp.is_direct_gig,
      gp.vendor_id
    FROM public.gig_partners gp
    JOIN public.profiles p ON gp.profile_id = p.id
    WHERE gp.is_active = true 
      AND gp.is_available = true
      AND gp.capacity_available >= p_case_count
      AND gp.is_direct_gig = true -- Only direct gig workers
      AND (p_pincode = ANY(gp.coverage_pincodes) OR gp.coverage_pincodes = '{}')
    
    UNION ALL
    
    -- Vendors (with capacity)
    SELECT 
      v.id as candidate_id,
      'vendor'::TEXT as candidate_type,
      v.name,
      v.email,
      v.phone,
      v.capacity_available,
      -- Vendor performance score (based on team performance)
      (COALESCE(v.performance_score, 0) * 0.4 + 
       COALESCE(v.quality_score, 0) * 0.4 + 
       0.2) as performance_score, -- Default acceptance rate for vendors
      COALESCE(v.quality_score, 0) as quality_score,
      COALESCE(v.performance_score, 0) as completion_rate,
      COALESCE(v.performance_score, 0) as ontime_completion_rate,
      1.0 as acceptance_rate, -- Vendors always accept
      0::DECIMAL as distance_km, -- TODO: Calculate actual distance
      false as is_direct_gig,
      v.id as vendor_id
    FROM public.vendors v
    WHERE v.is_active = true
      AND v.capacity_available >= p_case_count
      AND (p_pincode = ANY(v.coverage_pincodes) OR v.coverage_pincodes = '{}')
  )
  SELECT 
    cs.candidate_id,
    cs.candidate_type,
    cs.name,
    cs.email,
    cs.phone,
    cs.capacity_available,
    cs.performance_score,
    cs.quality_score,
    cs.completion_rate,
    cs.ontime_completion_rate,
    cs.acceptance_rate,
    cs.distance_km,
    cs.is_direct_gig,
    cs.vendor_id
  FROM candidate_scores cs
  WHERE cs.performance_score >= 0.3 -- Minimum performance threshold
  ORDER BY 
    cs.performance_score DESC,
    cs.quality_score DESC,
    cs.capacity_available DESC,
    cs.distance_km ASC;
END;
$$;

-- Create function to allocate cases with vendor support
CREATE OR REPLACE FUNCTION public.allocate_cases_with_vendors(
  p_case_ids UUID[],
  p_pincode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  case_id UUID;
  candidate RECORD;
  allocation_count INTEGER := 0;
  failed_allocations INTEGER := 0;
  result JSONB;
  case_count INTEGER;
BEGIN
  case_count := array_length(p_case_ids, 1);
  
  -- Get the best candidate for this pincode
  SELECT * INTO candidate
  FROM public.get_allocation_candidates_with_vendors(p_pincode, case_count)
  LIMIT 1;
  
  IF candidate IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No suitable candidates found for allocation',
      'allocated_count', 0,
      'failed_count', case_count
    );
  END IF;
  
  -- Allocate each case
  FOREACH case_id IN ARRAY p_case_ids
  LOOP
    BEGIN
      IF candidate.candidate_type = 'gig_worker' THEN
        -- Allocate to gig worker
        UPDATE public.cases
        SET 
          current_assignee_id = candidate.candidate_id,
          current_assignee_type = 'gig',
          current_vendor_id = candidate.vendor_id,
          status = 'allocated',
          allocation_method = 'auto',
          status_updated_at = now()
        WHERE id = case_id;
        
        -- Update gig worker capacity
        UPDATE public.gig_partners
        SET 
          capacity_available = capacity_available - 1,
          active_cases_count = active_cases_count + 1
        WHERE id = candidate.candidate_id;
        
        allocation_count := allocation_count + 1;
        
      ELSIF candidate.candidate_type = 'vendor' THEN
        -- Allocate to vendor
        UPDATE public.cases
        SET 
          current_vendor_id = candidate.candidate_id,
          current_assignee_type = 'vendor',
          status = 'allocated',
          allocation_method = 'auto',
          status_updated_at = now()
        WHERE id = case_id;
        
        -- Update vendor capacity
        UPDATE public.vendors
        SET 
          capacity_available = capacity_available - 1,
          active_cases_count = active_cases_count + 1
        WHERE id = candidate.candidate_id;
        
        allocation_count := allocation_count + 1;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        failed_allocations := failed_allocations + 1;
        -- Log error but continue with other cases
        RAISE WARNING 'Failed to allocate case %: %', case_id, SQLERRM;
    END;
  END LOOP;
  
  -- Build result
  result := jsonb_build_object(
    'success', true,
    'allocated_count', allocation_count,
    'failed_count', failed_allocations,
    'candidate_type', candidate.candidate_type,
    'candidate_name', candidate.name,
    'candidate_id', candidate.candidate_id
  );
  
  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_allocation_candidates_with_vendors TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_cases_with_vendors TO authenticated;

-- Test the new allocation function
SELECT public.get_allocation_candidates_with_vendors('110001', 1);
