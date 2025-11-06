-- Create otp_tokens table for OTP verification (gig workers only)
CREATE TABLE IF NOT EXISTS public.otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'account_setup')),
  is_verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_otp_tokens_user_id ON public.otp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone ON public.otp_tokens(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON public.otp_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.otp_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for otp_tokens
-- Users can read their own OTP tokens
CREATE POLICY "Users can read own otp tokens"
  ON public.otp_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update (for edge functions)
CREATE POLICY "Service role can manage otp tokens"
  ON public.otp_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to cleanup expired OTP tokens (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.otp_tokens
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$;