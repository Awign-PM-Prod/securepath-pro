-- Create password setup tokens table for gig workers
-- This table stores tokens sent to gig workers for initial password setup

CREATE TABLE IF NOT EXISTS public.password_setup_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT password_setup_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT password_setup_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT password_setup_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_email_token 
ON public.password_setup_tokens (email, token) 
WHERE is_used = false;

CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_expires_at 
ON public.password_setup_tokens (expires_at) 
WHERE is_used = false;

-- Enable RLS
ALTER TABLE public.password_setup_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own setup tokens" ON public.password_setup_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all setup tokens" ON public.password_setup_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'vendor_team', 'ops_team')
    )
  );

-- Function to generate setup token
CREATE OR REPLACE FUNCTION public.generate_password_setup_token(
  p_user_id uuid,
  p_email text,
  p_created_by uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_value text;
  expires_at timestamp with time zone;
BEGIN
  -- Generate a random token (8 characters)
  token_value := upper(substring(gen_random_uuid()::text from 1 for 8));
  
  -- Set expiry to 24 hours from now
  expires_at := now() + interval '24 hours';
  
  -- Insert the token
  INSERT INTO public.password_setup_tokens (
    user_id,
    email,
    token,
    expires_at,
    created_by
  ) VALUES (
    p_user_id,
    p_email,
    token_value,
    expires_at,
    p_created_by
  );
  
  RETURN token_value;
END;
$$;

-- Function to validate setup token
CREATE OR REPLACE FUNCTION public.validate_password_setup_token(
  p_email text,
  p_token text
)
RETURNS TABLE (
  is_valid boolean,
  user_id uuid,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN pt.id IS NOT NULL AND pt.expires_at > now() AND pt.is_used = false 
      THEN true 
      ELSE false 
    END as is_valid,
    pt.user_id,
    pt.expires_at
  FROM public.password_setup_tokens pt
  WHERE pt.email = p_email 
  AND pt.token = p_token
  LIMIT 1;
END;
$$;

-- Function to mark token as used
CREATE OR REPLACE FUNCTION public.mark_setup_token_used(
  p_email text,
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.password_setup_tokens
  SET 
    is_used = true,
    used_at = now()
  WHERE email = p_email 
  AND token = p_token
  AND is_used = false
  AND expires_at > now();
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  
  RETURN updated_rows > 0;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.password_setup_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_password_setup_token(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_password_setup_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_setup_token_used(text, text) TO authenticated;

-- Clean up expired tokens (run this periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_setup_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.password_setup_tokens
  WHERE expires_at < now() - interval '7 days';
END;
$$;

-- Test the functions
DO $$
DECLARE
  test_user_id uuid;
  test_token text;
BEGIN
  -- Get a test user ID
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Generate a test token
    SELECT public.generate_password_setup_token(
      test_user_id, 
      'test@example.com', 
      test_user_id
    ) INTO test_token;
    
    RAISE NOTICE 'Password setup tokens table created successfully';
    RAISE NOTICE 'Test token generated: %', test_token;
  ELSE
    RAISE NOTICE 'Password setup tokens table created successfully';
    RAISE NOTICE 'No test user found, skipping test token generation';
  END IF;
END $$;
