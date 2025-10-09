-- Redesign client_contracts table to include tier-based pricing, working hours, bonuses, and penalties
-- This replaces the old rate_card system with a comprehensive client contract structure
-- Safe version that won't fail if functions don't exist

-- First, safely drop any existing functions that might conflict
DROP FUNCTION IF EXISTS public.get_case_defaults(uuid, text, integer);
DROP FUNCTION IF EXISTS public.get_rate_card_for_client_tier(uuid, pincode_tier, text);
DROP FUNCTION IF EXISTS public.get_rate_card_for_client_tier(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_location_from_pincode(text);

-- Drop foreign key constraints that reference rate_cards
DO $$ 
BEGIN
    -- Drop foreign key constraints that reference rate_cards
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'client_contracts_rate_card_id_fkey' 
               AND table_name = 'client_contracts') THEN
        ALTER TABLE public.client_contracts DROP CONSTRAINT client_contracts_rate_card_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'cases_rate_card_id_fkey' 
               AND table_name = 'cases') THEN
        ALTER TABLE public.cases DROP CONSTRAINT cases_rate_card_id_fkey;
    END IF;
    
    -- Drop the rate_cards table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_cards') THEN
        DROP TABLE public.rate_cards CASCADE;
    END IF;
END $$;

-- Add new columns to client_contracts table
DO $$ 
BEGIN
    -- Add tier-based pricing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier1_tat_days') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier1_tat_days integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier1_revenue_inr') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier1_revenue_inr numeric(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier1_base_payout_inr') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier1_base_payout_inr numeric(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier2_tat_days') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier2_tat_days integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier2_revenue_inr') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier2_revenue_inr numeric(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier2_base_payout_inr') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier2_base_payout_inr numeric(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier3_tat_days') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier3_tat_days integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier3_revenue_inr') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier3_revenue_inr numeric(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'tier3_base_payout_inr') THEN
        ALTER TABLE public.client_contracts ADD COLUMN tier3_base_payout_inr numeric(10,2);
    END IF;
    
    -- Add working hours columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'working_hours_start') THEN
        ALTER TABLE public.client_contracts ADD COLUMN working_hours_start time;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'working_hours_end') THEN
        ALTER TABLE public.client_contracts ADD COLUMN working_hours_end time;
    END IF;
    
    -- Add bonuses and penalties as JSONB columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'bonuses') THEN
        ALTER TABLE public.client_contracts ADD COLUMN bonuses jsonb DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'penalties') THEN
        ALTER TABLE public.client_contracts ADD COLUMN penalties jsonb DEFAULT '[]'::jsonb;
    END IF;
    
    -- Remove old columns that are no longer needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'rate_card_id') THEN
        ALTER TABLE public.client_contracts DROP COLUMN rate_card_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'default_tat_hours') THEN
        ALTER TABLE public.client_contracts DROP COLUMN default_tat_hours;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'priority_tat_hours') THEN
        ALTER TABLE public.client_contracts DROP COLUMN priority_tat_hours;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'rate_override_policy') THEN
        ALTER TABLE public.client_contracts DROP COLUMN rate_override_policy;
    END IF;
END $$;

-- Remove rate_card_id from cases table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'rate_card_id') THEN
        ALTER TABLE public.cases DROP COLUMN rate_card_id;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_contracts_client_id ON public.client_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_is_active ON public.client_contracts(is_active);
CREATE INDEX IF NOT EXISTS idx_client_contracts_contract_type ON public.client_contracts(contract_type);

-- Update RLS policies for client_contracts
DROP POLICY IF EXISTS "ops_team can manage client contracts" ON public.client_contracts;
DROP POLICY IF EXISTS "clients can view their contracts" ON public.client_contracts;

CREATE POLICY "ops_team can manage client contracts" ON public.client_contracts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() 
            AND role = 'ops_team'
        )
    );

CREATE POLICY "clients can view their contracts" ON public.client_contracts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() 
            AND role = 'client'
        )
    );

-- Create a function to get client contract pricing for a specific tier
CREATE OR REPLACE FUNCTION get_client_contract_pricing(
    p_client_id uuid,
    p_tier pincode_tier
)
RETURNS TABLE (
    tat_days integer,
    revenue_inr numeric,
    base_payout_inr numeric,
    working_hours_start time,
    working_hours_end time,
    bonuses jsonb,
    penalties jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE p_tier
            WHEN 'tier1' THEN cc.tier1_tat_days
            WHEN 'tier2' THEN cc.tier2_tat_days
            WHEN 'tier3' THEN cc.tier3_tat_days
        END as tat_days,
        CASE p_tier
            WHEN 'tier1' THEN cc.tier1_revenue_inr
            WHEN 'tier2' THEN cc.tier2_revenue_inr
            WHEN 'tier3' THEN cc.tier3_revenue_inr
        END as revenue_inr,
        CASE p_tier
            WHEN 'tier1' THEN cc.tier1_base_payout_inr
            WHEN 'tier2' THEN cc.tier2_base_payout_inr
            WHEN 'tier3' THEN cc.tier3_base_payout_inr
        END as base_payout_inr,
        cc.working_hours_start,
        cc.working_hours_end,
        cc.bonuses,
        cc.penalties
    FROM public.client_contracts cc
    WHERE cc.client_id = p_client_id 
    AND cc.is_active = true
    AND (
        (p_tier = 'tier1' AND cc.tier1_tat_days IS NOT NULL) OR
        (p_tier = 'tier2' AND cc.tier2_tat_days IS NOT NULL) OR
        (p_tier = 'tier3' AND cc.tier3_tat_days IS NOT NULL)
    )
    ORDER BY cc.created_at DESC
    LIMIT 1;
END;
$$;

-- Create a function to calculate bonus amount based on completion time
CREATE OR REPLACE FUNCTION calculate_bonus_amount(
    p_bonuses jsonb,
    p_tier pincode_tier,
    p_completion_hours numeric,
    p_working_hours_start time,
    p_working_hours_end time
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    bonus_record jsonb;
    total_bonus numeric := 0;
    bonus_amount numeric;
    time_after_acceptance numeric;
    applicable_tiers jsonb;
BEGIN
    -- Loop through all bonuses
    FOR bonus_record IN SELECT * FROM jsonb_array_elements(p_bonuses)
    LOOP
        -- Check if this bonus applies to the current tier
        applicable_tiers := bonus_record->'tiers';
        
        IF (applicable_tiers ? 'all') OR (applicable_tiers ? p_tier::text) THEN
            -- Calculate time after acceptance in working hours
            time_after_acceptance := p_completion_hours;
            
            -- Check if completion time is within the bonus threshold
            IF time_after_acceptance <= (bonus_record->>'time_after_acceptance')::numeric THEN
                bonus_amount := (bonus_record->>'amount')::numeric;
                total_bonus := total_bonus + bonus_amount;
            END IF;
        END IF;
    END LOOP;
    
    RETURN total_bonus;
END;
$$;

-- Create a function to calculate penalty amount based on completion time
CREATE OR REPLACE FUNCTION calculate_penalty_amount(
    p_penalties jsonb,
    p_tier pincode_tier,
    p_completion_hours numeric,
    p_tat_days integer,
    p_working_hours_start time,
    p_working_hours_end time
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    penalty_record jsonb;
    total_penalty numeric := 0;
    penalty_amount numeric;
    time_after_acceptance numeric;
    applicable_tiers jsonb;
    tat_hours numeric;
BEGIN
    -- Convert TAT days to hours (assuming 10 working hours per day)
    tat_hours := p_tat_days * 10;
    
    -- Loop through all penalties
    FOR penalty_record IN SELECT * FROM jsonb_array_elements(p_penalties)
    LOOP
        -- Check if this penalty applies to the current tier
        applicable_tiers := penalty_record->'tiers';
        
        IF (applicable_tiers ? 'all') OR (applicable_tiers ? p_tier::text) THEN
            -- Calculate time after acceptance in working hours
            time_after_acceptance := p_completion_hours;
            
            -- Check if completion time exceeds TAT
            IF time_after_acceptance > tat_hours THEN
                penalty_amount := (penalty_record->>'amount')::numeric;
                total_penalty := total_penalty + penalty_amount;
            END IF;
        END IF;
    END LOOP;
    
    RETURN total_penalty;
END;
$$;

-- Create the new get_case_defaults function with updated return type
CREATE OR REPLACE FUNCTION get_case_defaults(
    p_client_id uuid,
    p_pincode text,
    p_tat_hours integer DEFAULT NULL
)
RETURNS TABLE (
    city text,
    state text,
    tier pincode_tier,
    tat_hours integer,
    base_rate_inr numeric,
    total_rate_inr numeric,
    working_hours_start time,
    working_hours_end time,
    bonuses jsonb,
    penalties jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tier pincode_tier;
    v_city text;
    v_state text;
    v_contract_pricing record;
BEGIN
    -- Get pincode tier, city, and state
    SELECT pt.tier, pt.city, pt.state
    INTO v_tier, v_city, v_state
    FROM public.pincode_tiers pt
    WHERE pt.pincode = p_pincode
    LIMIT 1;
    
    -- If no pincode tier found, default to tier3
    IF v_tier IS NULL THEN
        v_tier := 'tier3';
        v_city := 'Unknown';
        v_state := 'Unknown';
    END IF;
    
    -- Get client contract pricing for the tier
    SELECT * INTO v_contract_pricing
    FROM get_client_contract_pricing(p_client_id, v_tier);
    
    -- Return the results
    RETURN QUERY
    SELECT 
        v_city,
        v_state,
        v_tier,
        COALESCE(p_tat_hours, v_contract_pricing.tat_days * 10) as tat_hours, -- Convert days to hours
        COALESCE(v_contract_pricing.base_payout_inr, 0) as base_rate_inr,
        COALESCE(v_contract_pricing.revenue_inr, 0) as total_rate_inr,
        v_contract_pricing.working_hours_start,
        v_contract_pricing.working_hours_end,
        v_contract_pricing.bonuses,
        v_contract_pricing.penalties;
END;
$$;

-- Create a simple function to get location from pincode (for backward compatibility)
CREATE OR REPLACE FUNCTION get_location_from_pincode(p_pincode text)
RETURNS TABLE (
    city text,
    state text,
    tier pincode_tier
)
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
    WHERE pt.pincode = p_pincode
    LIMIT 1;
    
    -- If no pincode found, return defaults
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            'Unknown'::text as city,
            'Unknown'::text as state,
            'tier3'::pincode_tier as tier;
    END IF;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_client_contract_pricing(uuid, pincode_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_bonus_amount(jsonb, pincode_tier, numeric, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_penalty_amount(jsonb, pincode_tier, numeric, integer, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION get_case_defaults(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_location_from_pincode(text) TO authenticated;
