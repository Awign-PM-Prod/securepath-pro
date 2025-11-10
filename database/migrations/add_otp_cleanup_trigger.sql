-- Migration: Add trigger to delete OTP tokens when gig worker is deleted
-- This ensures OTPs are cleaned up when a gig worker is removed from the system

-- Function to delete OTP tokens when gig_partners record is deleted
CREATE OR REPLACE FUNCTION public.cleanup_otp_tokens_on_gig_worker_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete OTP tokens associated with the deleted gig worker
  -- Check by phone number from profiles table or user_id
  DELETE FROM public.otp_tokens
  WHERE (
    -- Delete by user_id if it exists
    (OLD.user_id IS NOT NULL AND user_id = OLD.user_id)
    OR
    -- Delete by phone number from profiles
    (OLD.profile_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = OLD.profile_id
      AND p.phone = otp_tokens.phone_number
    ))
  );
  
  RETURN OLD;
END;
$$;

-- Create trigger on gig_partners table
DROP TRIGGER IF EXISTS trigger_cleanup_otp_tokens_on_gig_worker_delete ON public.gig_partners;

CREATE TRIGGER trigger_cleanup_otp_tokens_on_gig_worker_delete
  AFTER DELETE ON public.gig_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_otp_tokens_on_gig_worker_delete();

-- Also add cleanup when profiles are deleted (in case profile is deleted first)
CREATE OR REPLACE FUNCTION public.cleanup_otp_tokens_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete OTP tokens by phone number or user_id
  DELETE FROM public.otp_tokens
  WHERE (
    (OLD.user_id IS NOT NULL AND user_id = OLD.user_id)
    OR
    (OLD.phone IS NOT NULL AND phone_number = OLD.phone)
  );
  
  RETURN OLD;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_cleanup_otp_tokens_on_profile_delete ON public.profiles;

CREATE TRIGGER trigger_cleanup_otp_tokens_on_profile_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_otp_tokens_on_profile_delete();


















