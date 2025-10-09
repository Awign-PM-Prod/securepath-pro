-- Migration: Update client_contracts table for new structure
-- This migration ensures the client_contracts table has all necessary fields for the new case creation system

-- Add missing columns if they don't exist
ALTER TABLE public.client_contracts 
ADD COLUMN IF NOT EXISTS tier1_tat_days integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS tier1_revenue_inr numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tier1_base_payout_inr numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tier2_tat_days integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS tier2_revenue_inr numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tier2_base_payout_inr numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tier3_tat_days integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS tier3_revenue_inr numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tier3_base_payout_inr numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS working_hours_start time DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS working_hours_end time DEFAULT '19:00',
ADD COLUMN IF NOT EXISTS bonuses jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS penalties jsonb DEFAULT '[]'::jsonb;

-- Add check constraints for positive values
DO $$
BEGIN
    -- Add constraints only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_contracts_tier1_tat_days_positive') THEN
        ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_tier1_tat_days_positive CHECK (tier1_tat_days > 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_contracts_tier2_tat_days_positive') THEN
        ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_tier2_tat_days_positive CHECK (tier2_tat_days > 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_contracts_tier3_tat_days_positive') THEN
        ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_tier3_tat_days_positive CHECK (tier3_tat_days > 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_contracts_tier1_revenue_positive') THEN
        ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_tier1_revenue_positive CHECK (tier1_revenue_inr >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_contracts_tier2_revenue_positive') THEN
        ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_tier2_revenue_positive CHECK (tier2_revenue_inr >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_contracts_tier3_revenue_positive') THEN
        ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_tier3_revenue_positive CHECK (tier3_revenue_inr >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_contracts_tier1_payout_positive') THEN
        ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_tier1_payout_positive CHECK (tier1_base_payout_inr >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_contracts_tier2_payout_positive') THEN
        ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_tier2_payout_positive CHECK (tier2_base_payout_inr >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'client_contracts_tier3_payout_positive') THEN
        ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_tier3_payout_positive CHECK (tier3_base_payout_inr >= 0);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.client_contracts.tier1_tat_days IS 'TAT in days for Tier 1 (metro) locations';
COMMENT ON COLUMN public.client_contracts.tier1_revenue_inr IS 'Revenue per case for Tier 1 locations';
COMMENT ON COLUMN public.client_contracts.tier1_base_payout_inr IS 'Base payout for gig workers/vendors for Tier 1 locations';
COMMENT ON COLUMN public.client_contracts.tier2_tat_days IS 'TAT in days for Tier 2 (city) locations';
COMMENT ON COLUMN public.client_contracts.tier2_revenue_inr IS 'Revenue per case for Tier 2 locations';
COMMENT ON COLUMN public.client_contracts.tier2_base_payout_inr IS 'Base payout for gig workers/vendors for Tier 2 locations';
COMMENT ON COLUMN public.client_contracts.tier3_tat_days IS 'TAT in days for Tier 3 (rural) locations';
COMMENT ON COLUMN public.client_contracts.tier3_revenue_inr IS 'Revenue per case for Tier 3 locations';
COMMENT ON COLUMN public.client_contracts.tier3_base_payout_inr IS 'Base payout for gig workers/vendors for Tier 3 locations';
COMMENT ON COLUMN public.client_contracts.working_hours_start IS 'Start time for gig worker working hours';
COMMENT ON COLUMN public.client_contracts.working_hours_end IS 'End time for gig worker working hours';
COMMENT ON COLUMN public.client_contracts.bonuses IS 'JSON array of bonus rules for early completion';
COMMENT ON COLUMN public.client_contracts.penalties IS 'JSON array of penalty rules for late completion';

-- Update existing contracts with default values if they are NULL
UPDATE public.client_contracts 
SET 
    tier1_tat_days = COALESCE(tier1_tat_days, 1),
    tier1_revenue_inr = COALESCE(tier1_revenue_inr, 0.00),
    tier1_base_payout_inr = COALESCE(tier1_base_payout_inr, 0.00),
    tier2_tat_days = COALESCE(tier2_tat_days, 2),
    tier2_revenue_inr = COALESCE(tier2_revenue_inr, 0.00),
    tier2_base_payout_inr = COALESCE(tier2_base_payout_inr, 0.00),
    tier3_tat_days = COALESCE(tier3_tat_days, 3),
    tier3_revenue_inr = COALESCE(tier3_revenue_inr, 0.00),
    tier3_base_payout_inr = COALESCE(tier3_base_payout_inr, 0.00),
    working_hours_start = COALESCE(working_hours_start, '09:00'::time),
    working_hours_end = COALESCE(working_hours_end, '19:00'::time),
    bonuses = COALESCE(bonuses, '[]'::jsonb),
    penalties = COALESCE(penalties, '[]'::jsonb)
WHERE 
    tier1_tat_days IS NULL 
    OR tier1_revenue_inr IS NULL 
    OR tier1_base_payout_inr IS NULL
    OR tier2_tat_days IS NULL 
    OR tier2_revenue_inr IS NULL 
    OR tier2_base_payout_inr IS NULL
    OR tier3_tat_days IS NULL 
    OR tier3_revenue_inr IS NULL 
    OR tier3_base_payout_inr IS NULL
    OR working_hours_start IS NULL
    OR working_hours_end IS NULL
    OR bonuses IS NULL
    OR penalties IS NULL;

-- Make required fields NOT NULL after setting default values
ALTER TABLE public.client_contracts 
ALTER COLUMN tier1_tat_days SET NOT NULL,
ALTER COLUMN tier1_revenue_inr SET NOT NULL,
ALTER COLUMN tier1_base_payout_inr SET NOT NULL,
ALTER COLUMN tier2_tat_days SET NOT NULL,
ALTER COLUMN tier2_revenue_inr SET NOT NULL,
ALTER COLUMN tier2_base_payout_inr SET NOT NULL,
ALTER COLUMN tier3_tat_days SET NOT NULL,
ALTER COLUMN tier3_revenue_inr SET NOT NULL,
ALTER COLUMN tier3_base_payout_inr SET NOT NULL,
ALTER COLUMN working_hours_start SET NOT NULL,
ALTER COLUMN working_hours_end SET NOT NULL,
ALTER COLUMN bonuses SET NOT NULL,
ALTER COLUMN penalties SET NOT NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_contracts_client_contract_type ON public.client_contracts(client_id, contract_type);
CREATE INDEX IF NOT EXISTS idx_client_contracts_is_active ON public.client_contracts(is_active);

-- Update the get_case_defaults function to work with the updated client_contracts structure
CREATE OR REPLACE FUNCTION public.get_case_defaults(
    p_client_id uuid,
    p_contract_type text,
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
    working_hours_start text,
    working_hours_end text,
    bonuses jsonb,
    penalties jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.city,
        pt.state,
        pt.tier,
        CASE 
            WHEN p_tat_hours IS NOT NULL THEN p_tat_hours
            WHEN pt.tier = 'tier1' THEN COALESCE(cc.tier1_tat_days * 24, 24)
            WHEN pt.tier = 'tier2' THEN COALESCE(cc.tier2_tat_days * 24, 48)
            WHEN pt.tier = 'tier3' THEN COALESCE(cc.tier3_tat_days * 24, 72)
            ELSE 24
        END as tat_hours,
        CASE 
            WHEN pt.tier = 'tier1' THEN COALESCE(cc.tier1_base_payout_inr, 0)
            WHEN pt.tier = 'tier2' THEN COALESCE(cc.tier2_base_payout_inr, 0)
            WHEN pt.tier = 'tier3' THEN COALESCE(cc.tier3_base_payout_inr, 0)
            ELSE 0
        END as base_rate_inr,
        CASE 
            WHEN pt.tier = 'tier1' THEN COALESCE(cc.tier1_base_payout_inr, 0)
            WHEN pt.tier = 'tier2' THEN COALESCE(cc.tier2_base_payout_inr, 0)
            WHEN pt.tier = 'tier3' THEN COALESCE(cc.tier3_base_payout_inr, 0)
            ELSE 0
        END as total_rate_inr,
        COALESCE(cc.working_hours_start::text, '09:00') as working_hours_start,
        COALESCE(cc.working_hours_end::text, '19:00') as working_hours_end,
        COALESCE(cc.bonuses, '[]'::jsonb) as bonuses,
        COALESCE(cc.penalties, '[]'::jsonb) as penalties
    FROM public.pincode_tiers pt
    LEFT JOIN public.client_contracts cc ON (
        cc.client_id = p_client_id 
        AND cc.contract_type = p_contract_type
        AND cc.is_active = true
    )
    WHERE pt.pincode = p_pincode
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
