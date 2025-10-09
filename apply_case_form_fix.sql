-- =====================================================
-- Apply Case Form Logic Fix
-- Copy and paste this into Supabase SQL Editor
-- =====================================================

-- 1. Add missing columns to cases table
DO $$
BEGIN
    -- Add client_case_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'client_case_id') THEN
        ALTER TABLE public.cases ADD COLUMN client_case_id TEXT NOT NULL DEFAULT 'N/A';
    END IF;
    
    -- Add travel_allowance_inr column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'travel_allowance_inr') THEN
        ALTER TABLE public.cases ADD COLUMN travel_allowance_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00;
    END IF;
    
    -- Add bonus_inr column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'bonus_inr') THEN
        ALTER TABLE public.cases ADD COLUMN bonus_inr DECIMAL(10,2) NOT NULL DEFAULT 0.00;
    END IF;
    
    -- Add instructions column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'instructions') THEN
        ALTER TABLE public.cases ADD COLUMN instructions TEXT;
    END IF;
END $$;

-- Update existing rows to have unique client_case_id
UPDATE public.cases
SET client_case_id = 'DEFAULT-' || id
WHERE client_case_id = 'N/A';

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
ALTER COLUMN client_case_id DROP DEFAULT;

-- 2. Update client_contracts to have rate cards for all tiers
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

-- 3. Create a function to get city/state from pincode
CREATE OR REPLACE FUNCTION public.get_location_from_pincode(p_pincode text)
RETURNS TABLE(city text, state text, tier pincode_tier)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pt.city,
    pt.state,
    pt.tier
  FROM public.pincode_tiers pt
  WHERE pt.pincode = p_pincode AND pt.is_active = true
  LIMIT 1;
  
  -- If no data found, return defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'Unknown'::text, 'Unknown'::text, 'tier_3'::pincode_tier;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_location_from_pincode(text) TO authenticated;

-- 4. Create a function to get rate card for client and tier
CREATE OR REPLACE FUNCTION public.get_rate_card_for_client_tier(
  p_client_id uuid,
  p_tier pincode_tier,
  p_completion_slab completion_slab
)
RETURNS TABLE(
  rate_card_id uuid,
  base_rate_inr numeric,
  travel_allowance_inr numeric,
  bonus_inr numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- If rate card found, return it
  IF FOUND THEN
    RETURN QUERY SELECT 
      rate_card_record.id,
      rate_card_record.base_rate_inr,
      rate_card_record.default_travel_inr,
      rate_card_record.default_bonus_inr;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_rate_card_for_client_tier(uuid, pincode_tier, completion_slab) TO authenticated;

-- 5. Create a comprehensive function to get case defaults
CREATE OR REPLACE FUNCTION public.get_case_defaults(
  p_client_id uuid,
  p_pincode text,
  p_tat_hours integer
)
RETURNS TABLE(
  city text,
  state text,
  tier pincode_tier,
  rate_card_id uuid,
  base_rate_inr numeric,
  travel_allowance_inr numeric,
  bonus_inr numeric,
  default_tat_hours integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  location_data RECORD;
  rate_data RECORD;
  contract_data RECORD;
  completion_slab_value completion_slab;
BEGIN
  -- Get location data from pincode
  SELECT * INTO location_data
  FROM public.get_location_from_pincode(p_pincode);
  
  -- Get completion slab from TAT hours
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
  
  -- Return the combined data
  RETURN QUERY SELECT 
    location_data.city,
    location_data.state,
    location_data.tier,
    rate_data.rate_card_id,
    COALESCE(rate_data.base_rate_inr, 0),
    COALESCE(rate_data.travel_allowance_inr, 0),
    COALESCE(rate_data.bonus_inr, 0),
    COALESCE(contract_data.default_tat_hours, 24);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_case_defaults(uuid, text, integer) TO authenticated;

-- 6. Create indexes for performance
DO $$
BEGIN
    -- Create index for cases client_case_id
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cases_client_case_id') THEN
        CREATE INDEX idx_cases_client_case_id ON public.cases(client_id, client_case_id);
    END IF;
    
    -- Create index for client_contracts tier rate cards
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_client_contracts_tier_rate_cards') THEN
        CREATE INDEX idx_client_contracts_tier_rate_cards ON public.client_contracts(tier_1_rate_card_id, tier_2_rate_card_id, tier_3_rate_card_id);
    END IF;
END $$;

-- Verify the changes
SELECT 'Cases table updated with missing columns' as status;
SELECT 'Client contracts updated with tier-specific rate cards' as status;
SELECT 'Functions created for location and rate lookup' as status;
