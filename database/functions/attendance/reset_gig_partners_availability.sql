-- =====================================================
-- Reset Gig Partners Availability
-- Background Verification Platform
-- =====================================================
-- This function resets is_available to False for all gig_partners
-- Should be called daily at 6:00 AM

CREATE OR REPLACE FUNCTION public.reset_gig_partners_availability()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset is_available to False for all active gig partners
  UPDATE public.gig_partners 
  SET 
    is_available = false,
    updated_at = now()
  WHERE is_active = true;
  
  -- Log the reset
  INSERT INTO public.audit_logs (
    table_name,
    operation,
    old_values,
    new_values,
    user_id,
    created_at
  ) VALUES (
    'gig_partners',
    'AVAILABILITY_RESET',
    '{}',
    jsonb_build_object('reset_at', now(), 'reset_count', (SELECT COUNT(*) FROM public.gig_partners WHERE is_active = true)),
    '00000000-0000-0000-0000-000000000000'::UUID,
    now()
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.reset_gig_partners_availability() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_gig_partners_availability() TO service_role;






