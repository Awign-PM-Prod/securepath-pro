-- =====================================================
-- Add Missing Columns to Cases Table
-- Based on DATABASE_SCHEMA_DESIGN.md analysis
-- =====================================================

-- Add missing columns to cases table
DO $$
BEGIN
    -- Add client_case_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'client_case_id') THEN
        ALTER TABLE public.cases ADD COLUMN client_case_id TEXT;
    END IF;
    
    -- Add travel_allowance_inr column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'travel_allowance_inr') THEN
        ALTER TABLE public.cases ADD COLUMN travel_allowance_inr NUMERIC(10,2) NOT NULL DEFAULT 0.00;
    END IF;
    
    -- Add bonus_inr column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'bonus_inr') THEN
        ALTER TABLE public.cases ADD COLUMN bonus_inr NUMERIC(10,2) NOT NULL DEFAULT 0.00;
    END IF;
    
    -- Add instructions column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'instructions') THEN
        ALTER TABLE public.cases ADD COLUMN instructions TEXT;
    END IF;
END $$;

-- Update existing rows to have unique client_case_id if needed
UPDATE public.cases
SET client_case_id = 'DEFAULT-' || id
WHERE client_case_id IS NULL;

-- Add unique constraint for client_case_id per client
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_client_case_id_per_client'
    ) THEN
        ALTER TABLE public.cases
        ADD CONSTRAINT unique_client_case_id_per_client UNIQUE (client_id, client_case_id);
    END IF;
END $$;

-- Make client_case_id non-nullable after initial population
ALTER TABLE public.cases
ALTER COLUMN client_case_id SET NOT NULL;

-- Add missing columns to client_contracts table
DO $$
BEGIN
    -- Add tier_1_rate_card_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier_1_rate_card_id') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier_1_rate_card_id UUID REFERENCES public.rate_cards(id);
    END IF;
    
    -- Add tier_2_rate_card_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier_2_rate_card_id') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier_2_rate_card_id UUID REFERENCES public.rate_cards(id);
    END IF;
    
    -- Add tier_3_rate_card_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier_3_rate_card_id') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier_3_rate_card_id UUID REFERENCES public.rate_cards(id);
    END IF;
END $$;

-- Create pincode_tiers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.pincode_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pincode TEXT NOT NULL UNIQUE,
  tier pincode_tier NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pincode_tiers_pincode ON public.pincode_tiers(pincode);
CREATE INDEX IF NOT EXISTS idx_pincode_tiers_tier ON public.pincode_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_pincode_tiers_active ON public.pincode_tiers(is_active);

-- Enable RLS on pincode_tiers table
ALTER TABLE public.pincode_tiers ENABLE ROW LEVEL SECURITY;

-- Policy for ops_team and super_admin to manage pincode tiers
CREATE POLICY IF NOT EXISTS "Ops team can manage pincode tiers"
  ON public.pincode_tiers FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin'));

-- Policy for public read access to active pincode tiers
CREATE POLICY IF NOT EXISTS "Public read access for pincode tiers"
  ON public.pincode_tiers FOR SELECT
  USING (is_active = TRUE);

-- Insert sample data if pincode_tiers is empty
INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '110001', 'tier_1', 'New Delhi', 'Delhi', 'North', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '110001');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '400001', 'tier_1', 'Mumbai', 'Maharashtra', 'West', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '400001');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '560001', 'tier_1', 'Bengaluru', 'Karnataka', 'South', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '560001');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '560102', 'tier_2', 'Bangalore', 'Karnataka', 'South', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '560102');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '302001', 'tier_2', 'Jaipur', 'Rajasthan', 'North', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '302001');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '411001', 'tier_2', 'Pune', 'Maharashtra', 'West', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '411001');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '500001', 'tier_2', 'Hyderabad', 'Telangana', 'South', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '500001');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '700001', 'tier_3', 'Kolkata', 'West Bengal', 'East', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '700001');

INSERT INTO public.pincode_tiers (pincode, tier, city, state, region, created_by)
SELECT '600001', 'tier_3', 'Chennai', 'Tamil Nadu', 'South', (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.pincode_tiers WHERE pincode = '600001');

-- Create the database functions
CREATE OR REPLACE FUNCTION public.get_location_from_pincode(p_pincode text)
RETURNS TABLE(city text, state text, tier pincode_tier)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT pt.city, pt.state, pt.tier
    FROM public.pincode_tiers pt
    WHERE pt.pincode = p_pincode AND pt.is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        -- Return default/unknown values if pincode not found
        RETURN QUERY SELECT 'Unknown'::text, 'Unknown'::text, 'tier_3'::pincode_tier;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_rate_card_for_client_tier(
    p_client_id UUID,
    p_tier pincode_tier,
    p_completion_slab completion_slab
)
RETURNS TABLE(
    rate_card_id UUID,
    rate_card_name TEXT,
    base_rate_inr NUMERIC,
    travel_allowance_inr NUMERIC,
    bonus_inr NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  contract_record RECORD;
  rate_card_record RECORD;
BEGIN
  -- Get the active client contract
  SELECT 
    cc.tier_1_rate_card_id,
    cc.tier_2_rate_card_id,
    cc.tier_3_rate_card_id
  INTO contract_record
  FROM public.client_contracts cc
  WHERE cc.client_id = p_client_id 
    AND cc.is_active = true
    AND cc.start_date <= CURRENT_DATE
    AND (cc.end_date IS NULL OR cc.end_date >= CURRENT_DATE)
  ORDER BY cc.created_at DESC
  LIMIT 1;
  
  -- If no contract found, return null
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Get the appropriate rate card based on tier
  CASE p_tier
    WHEN 'tier_1' THEN
      SELECT rc.id, rc.base_rate_inr, rc.default_travel_inr, rc.default_bonus_inr
      INTO rate_card_record
      FROM public.rate_cards rc
      WHERE rc.id = contract_record.tier_1_rate_card_id
        AND rc.completion_slab = p_completion_slab
        AND rc.is_active = true;
    WHEN 'tier_2' THEN
      SELECT rc.id, rc.base_rate_inr, rc.default_travel_inr, rc.default_bonus_inr
      INTO rate_card_record
      FROM public.rate_cards rc
      WHERE rc.id = contract_record.tier_2_rate_card_id
        AND rc.completion_slab = p_completion_slab
        AND rc.is_active = true;
    WHEN 'tier_3' THEN
      SELECT rc.id, rc.base_rate_inr, rc.default_travel_inr, rc.default_bonus_inr
      INTO rate_card_record
      FROM public.rate_cards rc
      WHERE rc.id = contract_record.tier_3_rate_card_id
        AND rc.completion_slab = p_completion_slab
        AND rc.is_active = true;
  END CASE;

  -- Return the rate card information
  IF FOUND THEN
    rate_card_id := rate_card_record.id;
    rate_card_name := 'Rate Card'; -- You might want to get the actual name
    base_rate_inr := rate_card_record.base_rate_inr;
    travel_allowance_inr := rate_card_record.default_travel_inr;
    bonus_inr := rate_card_record.default_bonus_inr;
    RETURN NEXT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_case_defaults(
    p_client_id UUID,
    p_pincode TEXT,
    p_tat_hours INTEGER
)
RETURNS TABLE(
    city TEXT,
    state TEXT,
    tier pincode_tier,
    default_tat_hours INTEGER,
    rate_card_id UUID,
    rate_card_name TEXT,
    base_rate_inr NUMERIC,
    travel_allowance_inr NUMERIC,
    bonus_inr NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  location_data RECORD;
  contract_data RECORD;
  rate_data RECORD;
  completion_slab_value completion_slab;
  default_tat INTEGER := 24;
BEGIN
  -- Get location details and pincode tier
  SELECT * INTO location_data FROM public.get_location_from_pincode(p_pincode);
  
  -- Determine completion slab based on TAT hours
  completion_slab_value := CASE
    WHEN p_tat_hours <= 24 THEN 'within_24h'::completion_slab
    WHEN p_tat_hours <= 48 THEN 'within_48h'::completion_slab
    WHEN p_tat_hours <= 72 THEN 'within_72h'::completion_slab
    WHEN p_tat_hours <= 168 THEN 'within_168h'::completion_slab
    ELSE 'beyond_168h'::completion_slab
  END;
  
  -- Get client contract defaults
  SELECT 
    cc.default_tat_hours,
    cc.tier_1_rate_card_id,
    cc.tier_2_rate_card_id,
    cc.tier_3_rate_card_id
  INTO contract_data
  FROM public.client_contracts cc
  WHERE cc.client_id = p_client_id 
    AND cc.is_active = true
    AND cc.start_date <= CURRENT_DATE
    AND (cc.end_date IS NULL OR cc.end_date >= CURRENT_DATE)
  ORDER BY cc.created_at DESC
  LIMIT 1;
  
  -- Get rate card data
  SELECT * INTO rate_data
  FROM public.get_rate_card_for_client_tier(p_client_id, location_data.tier, completion_slab_value);
  
  -- Set default TAT if contract found
  IF FOUND THEN
    default_tat := contract_data.default_tat_hours;
  END IF;
  
  -- Return all defaults
  city := location_data.city;
  state := location_data.state;
  tier := location_data.tier;
  default_tat_hours := default_tat;
  rate_card_id := rate_data.rate_card_id;
  rate_card_name := rate_data.rate_card_name;
  base_rate_inr := rate_data.base_rate_inr;
  travel_allowance_inr := rate_data.travel_allowance_inr;
  bonus_inr := rate_data.bonus_inr;

  RETURN NEXT;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_location_from_pincode(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rate_card_for_client_tier(uuid, pincode_tier, completion_slab) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_case_defaults(uuid, text, integer) TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_client_case_id ON public.cases(client_id, client_case_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_tier_rate_cards ON public.client_contracts(tier_1_rate_card_id, tier_2_rate_card_id, tier_3_rate_card_id);

-- Verify the changes
SELECT 'Cases table updated with missing columns' as status;
SELECT 'Client contracts updated with tier-specific rate cards' as status;
SELECT 'Pincode tiers table created with sample data' as status;
SELECT 'Database functions created for location and rate lookup' as status;

