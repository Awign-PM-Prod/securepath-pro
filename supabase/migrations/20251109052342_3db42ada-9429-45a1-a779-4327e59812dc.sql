-- Phase 1: Make phone number required for all users

-- First, update any existing profiles without phone numbers to have a placeholder
UPDATE public.profiles 
SET phone = 'PENDING_PHONE_' || id::text 
WHERE phone IS NULL OR phone = '';

-- Now make phone NOT NULL
ALTER TABLE public.profiles 
ALTER COLUMN phone SET NOT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.phone IS 'Required phone number for OTP authentication';

-- Update otp_tokens to ensure it works for all roles
-- Add index for faster lookup by phone number
CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_purpose 
ON public.otp_tokens(phone_number, purpose, is_verified);

-- Add index on profiles for phone lookup during login
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
ON public.profiles(phone);