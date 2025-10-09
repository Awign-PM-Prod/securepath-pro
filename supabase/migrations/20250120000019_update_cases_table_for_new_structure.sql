-- Migration: Update cases table for new case creation structure
-- This migration adds new fields to the cases table to support the redesigned case creation system

-- Add new columns to cases table
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS contract_type text,
ADD COLUMN IF NOT EXISTS candidate_name text,
ADD COLUMN IF NOT EXISTS phone_primary text,
ADD COLUMN IF NOT EXISTS phone_secondary text,
ADD COLUMN IF NOT EXISTS vendor_tat_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS bonus_inr numeric NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS penalty_inr numeric NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_payout_inr numeric NOT NULL DEFAULT 0.00;

-- Add foreign key constraint for contract_type (references contract_type_config)
-- Note: This will only work if contract_type_config table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_type_config') THEN
        -- Check if constraint already exists before adding
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'cases_contract_type_fkey' 
            AND table_name = 'cases'
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.cases 
            ADD CONSTRAINT cases_contract_type_fkey 
            FOREIGN KEY (contract_type) REFERENCES public.contract_type_config(type_key);
            
            RAISE NOTICE 'Added foreign key constraint cases_contract_type_fkey';
        ELSE
            RAISE NOTICE 'Foreign key constraint cases_contract_type_fkey already exists';
        END IF;
    ELSE
        RAISE NOTICE 'contract_type_config table does not exist, skipping foreign key constraint';
    END IF;
END $$;

-- Add check constraints for positive values
DO $$
BEGIN
    -- Add constraints only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cases_bonus_inr_positive') THEN
        ALTER TABLE public.cases ADD CONSTRAINT cases_bonus_inr_positive CHECK (bonus_inr >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cases_penalty_inr_positive') THEN
        ALTER TABLE public.cases ADD CONSTRAINT cases_penalty_inr_positive CHECK (penalty_inr >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cases_total_payout_inr_positive') THEN
        ALTER TABLE public.cases ADD CONSTRAINT cases_total_payout_inr_positive CHECK (total_payout_inr >= 0);
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cases_contract_type ON public.cases(contract_type);
CREATE INDEX IF NOT EXISTS idx_cases_candidate_name ON public.cases(candidate_name);
CREATE INDEX IF NOT EXISTS idx_cases_phone_primary ON public.cases(phone_primary);
CREATE INDEX IF NOT EXISTS idx_cases_vendor_tat_start_date ON public.cases(vendor_tat_start_date);

-- Update existing cases to have default values for new required fields
UPDATE public.cases 
SET 
    contract_type = 'residential_address_check',
    candidate_name = COALESCE(metadata->>'candidate_name', 'Unknown Candidate'),
    phone_primary = COALESCE(metadata->>'phone_primary', '0000000000'),
    vendor_tat_start_date = COALESCE(created_at, now()),
    total_payout_inr = COALESCE(base_rate_inr, 0) + COALESCE(bonus_inr, 0) - COALESCE(penalty_inr, 0)
WHERE 
    contract_type IS NULL 
    OR candidate_name IS NULL 
    OR phone_primary IS NULL 
    OR vendor_tat_start_date IS NULL;

-- Make required fields NOT NULL after setting default values
ALTER TABLE public.cases 
ALTER COLUMN contract_type SET NOT NULL,
ALTER COLUMN candidate_name SET NOT NULL,
ALTER COLUMN phone_primary SET NOT NULL,
ALTER COLUMN vendor_tat_start_date SET NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.cases.contract_type IS 'Type of contract (residential_address_check, business_address_check, etc.)';
COMMENT ON COLUMN public.cases.candidate_name IS 'Full name of the person being verified';
COMMENT ON COLUMN public.cases.phone_primary IS 'Primary contact phone number';
COMMENT ON COLUMN public.cases.phone_secondary IS 'Secondary contact phone number (optional)';
COMMENT ON COLUMN public.cases.vendor_tat_start_date IS 'Date when vendor TAT period starts';
COMMENT ON COLUMN public.cases.bonus_inr IS 'Bonus amount for early completion';
COMMENT ON COLUMN public.cases.penalty_inr IS 'Penalty amount for late completion';
COMMENT ON COLUMN public.cases.total_payout_inr IS 'Total payout amount (base + bonus - penalty)';

-- Update RLS policies to include new columns
-- Note: This assumes RLS is already enabled on the cases table
-- The existing policies should work with the new columns

-- Create a function to calculate total payout
CREATE OR REPLACE FUNCTION public.calculate_total_payout(
    base_rate numeric,
    bonus numeric DEFAULT 0,
    penalty numeric DEFAULT 0
) RETURNS numeric AS $$
BEGIN
    RETURN base_rate + bonus - penalty;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically calculate total_payout_inr
CREATE OR REPLACE FUNCTION public.update_total_payout()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_payout_inr = public.calculate_total_payout(
        NEW.base_rate_inr,
        NEW.bonus_inr,
        NEW.penalty_inr
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_total_payout ON public.cases;
CREATE TRIGGER trigger_update_total_payout
    BEFORE INSERT OR UPDATE ON public.cases
    FOR EACH ROW
    EXECUTE FUNCTION public.update_total_payout();

-- Update the get_case_defaults function to work with new structure
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
            ELSE COALESCE(cc.tier1_tat_days * 24, 24)
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
        cc.working_hours_start,
        cc.working_hours_end,
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
