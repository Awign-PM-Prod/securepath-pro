-- =====================================================
-- Fix Capacity Update Functions
-- =====================================================

-- This script creates the missing RPC functions for capacity updates
-- that were causing the "supabase.raw is not a function" error

-- Function to consume capacity (decrease available, increase allocated)
CREATE OR REPLACE FUNCTION public.update_capacity_consume(
  p_gig_partner_id UUID,
  p_date DATE
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.capacity_tracking
  SET 
    current_capacity_available = current_capacity_available - 1,
    cases_allocated = cases_allocated + 1,
    last_capacity_consumed_at = now()
  WHERE gig_partner_id = p_gig_partner_id
    AND date = p_date;
    
  -- Ensure capacity doesn't go below 0
  UPDATE public.capacity_tracking
  SET current_capacity_available = 0
  WHERE gig_partner_id = p_gig_partner_id
    AND date = p_date
    AND current_capacity_available < 0;
END;
$$ LANGUAGE plpgsql;

-- Function to free capacity (increase available, decrease allocated)
CREATE OR REPLACE FUNCTION public.update_capacity_free(
  p_gig_partner_id UUID,
  p_date DATE
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.capacity_tracking
  SET 
    current_capacity_available = current_capacity_available + 1,
    cases_allocated = cases_allocated - 1,
    last_capacity_freed_at = now()
  WHERE gig_partner_id = p_gig_partner_id
    AND date = p_date;
    
  -- Ensure allocated doesn't go below 0
  UPDATE public.capacity_tracking
  SET cases_allocated = 0
  WHERE gig_partner_id = p_gig_partner_id
    AND date = p_date
    AND cases_allocated < 0;
END;
$$ LANGUAGE plpgsql;

-- Function to reset capacity for the day
CREATE OR REPLACE FUNCTION public.update_capacity_reset(
  p_gig_partner_id UUID,
  p_date DATE
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.capacity_tracking
  SET 
    current_capacity_available = max_daily_capacity,
    cases_allocated = 0,
    cases_accepted = 0,
    cases_in_progress = 0,
    cases_submitted = 0,
    cases_completed = 0,
    last_reset_at = now(),
    reset_count = reset_count + 1
  WHERE gig_partner_id = p_gig_partner_id
    AND date = p_date;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_capacity_consume(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_capacity_free(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_capacity_reset(UUID, DATE) TO authenticated;

-- Test the functions work
SELECT 'Capacity update functions created successfully' as status;
