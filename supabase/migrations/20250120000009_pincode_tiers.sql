-- =====================================================
-- Pincode Tiers Table Migration
-- =====================================================

-- Create pincode_tiers table
CREATE TABLE IF NOT EXISTS public.pincode_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pincode text NOT NULL UNIQUE,
  tier pincode_tier NOT NULL,
  city text,
  state text,
  region text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pincode_tiers_pkey PRIMARY KEY (id),
  CONSTRAINT pincode_tiers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pincode_tiers_pincode ON public.pincode_tiers(pincode);
CREATE INDEX IF NOT EXISTS idx_pincode_tiers_tier ON public.pincode_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_pincode_tiers_active ON public.pincode_tiers(is_active);

-- Enable RLS
ALTER TABLE public.pincode_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Ops team can manage pincode tiers"
  ON public.pincode_tiers FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin'));

CREATE POLICY "Public read access for pincode tiers"
  ON public.pincode_tiers FOR SELECT
  USING (is_active = true);

-- Insert some sample data
INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
VALUES 
  ('110001', 'tier_1', 'New Delhi', 'Delhi', 'North', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1)),
  ('400001', 'tier_1', 'Mumbai', 'Maharashtra', 'West', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1)),
  ('560001', 'tier_1', 'Bangalore', 'Karnataka', 'South', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1)),
  ('600001', 'tier_1', 'Chennai', 'Tamil Nadu', 'South', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1)),
  ('700001', 'tier_1', 'Kolkata', 'West Bengal', 'East', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1)),
  ('302001', 'tier_2', 'Jaipur', 'Rajasthan', 'North', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1)),
  ('411001', 'tier_2', 'Pune', 'Maharashtra', 'West', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1)),
  ('500001', 'tier_2', 'Hyderabad', 'Telangana', 'South', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1)),
  ('380001', 'tier_2', 'Ahmedabad', 'Gujarat', 'West', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1)),
  ('560102', 'tier_2', 'Bangalore', 'Karnataka', 'South', (SELECT id FROM auth.users WHERE email = 'deepanshu.shahara@awign.com' LIMIT 1))
ON CONFLICT (pincode) DO NOTHING;

-- Fallback for admin user if the specific email doesn't exist
INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT 
  '110001', 'tier_1', 'New Delhi', 'Delhi', 'North', u.id
FROM auth.users u 
WHERE u.id IN (SELECT id FROM public.profiles WHERE role = 'super_admin' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '110001')
LIMIT 1;

-- Create function to get pincode tier
CREATE OR REPLACE FUNCTION public.get_pincode_tier(p_pincode text)
RETURNS pincode_tier
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_tier pincode_tier;
BEGIN
  SELECT tier INTO result_tier
  FROM public.pincode_tiers
  WHERE pincode = p_pincode AND is_active = true
  LIMIT 1;
  
  IF result_tier IS NULL THEN
    -- Default to tier_3 if pincode not found
    result_tier := 'tier_3';
  END IF;
  
  RETURN result_tier;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_pincode_tier(text) TO authenticated;

