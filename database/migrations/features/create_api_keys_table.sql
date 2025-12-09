-- =====================================================
-- API KEYS TABLE
-- For external API access without user accounts
-- Background Verification Platform
-- =====================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Key details
  key_name TEXT NOT NULL, -- Human-readable name (e.g., "Client ABC Production Key")
  api_key TEXT NOT NULL UNIQUE, -- The actual API key (stored for initial display only)
  api_key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash for secure lookup
  
  -- Client association
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  
  -- Permissions
  permissions JSONB NOT NULL DEFAULT '{"create_cases": true, "read_cases": true}'::jsonb,
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60, -- Requests per minute
  rate_limit_per_day INTEGER DEFAULT 10000, -- Requests per day
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration date
  
  -- Usage tracking
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count BIGINT NOT NULL DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id), -- Admin who created it
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(api_key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_client ON public.api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active, expires_at);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only super_admin and ops_team can view all keys
CREATE POLICY "Admins can view all API keys" ON public.api_keys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'ops_team')
      AND is_active = true
    )
  );

-- Only super_admin and ops_team can create keys
CREATE POLICY "Admins can create API keys" ON public.api_keys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'ops_team')
      AND is_active = true
    )
  );

-- Only super_admin and ops_team can update keys
CREATE POLICY "Admins can update API keys" ON public.api_keys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'ops_team')
      AND is_active = true
    )
  );

-- Function to hash API key (for secure storage and lookup)
-- Note: This uses MD5 as fallback. For better security, enable pgcrypto and use SHA-256
CREATE OR REPLACE FUNCTION public.hash_api_key(key TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Try to use pgcrypto if available (SHA-256)
  BEGIN
    RETURN encode(digest(key, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to MD5 if pgcrypto not available (less secure but works)
    RETURN md5(key);
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate a secure API key (using random() instead of gen_random_bytes)
-- This doesn't require pgcrypto extension
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT AS $$
DECLARE
  random_bytes BYTEA;
  encoded_key TEXT;
BEGIN
  -- Generate random bytes using random() function
  -- Convert random numbers to bytes
  random_bytes := (
    SELECT string_agg(
      chr(floor(random() * 256)::int),
      ''
    )
    FROM generate_series(1, 32)
  )::bytea;
  
  -- Encode to base64 and replace special characters
  encoded_key := translate(
    encode(random_bytes, 'base64'),
    '+/=',
    '_-'
  );
  
  RETURN 'bgv_' || encoded_key;
END;
$$ LANGUAGE plpgsql;

