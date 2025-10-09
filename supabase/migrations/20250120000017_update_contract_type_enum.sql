-- Update contract_type enum values and add unique constraint
-- This migration updates the contract type system to use specific verification types

-- First, let's check if contract_type is an enum or just a text field
DO $$
DECLARE
    is_enum boolean := false;
BEGIN
    -- Check if contract_type is an enum
    SELECT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'contract_type'
    ) INTO is_enum;
    
    IF is_enum THEN
        RAISE NOTICE 'contract_type is an enum, updating values...';
        
        -- Add new enum values
        ALTER TYPE contract_type ADD VALUE IF NOT EXISTS 'residential_address_check';
        ALTER TYPE contract_type ADD VALUE IF NOT EXISTS 'business_address_check';
        
        RAISE NOTICE 'Added new enum values: residential_address_check, business_address_check';
    ELSE
        RAISE NOTICE 'contract_type is not an enum, it is a text field';
    END IF;
END $$;

-- Add unique constraint for client_id and contract_type combination
-- This ensures only one contract per client per contract type
DO $$
BEGIN
    -- Check if the unique constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_client_contract_type' 
        AND table_name = 'client_contracts'
        AND table_schema = 'public'
    ) THEN
        -- Add unique constraint
        ALTER TABLE public.client_contracts 
        ADD CONSTRAINT unique_client_contract_type 
        UNIQUE (client_id, contract_type);
        
        RAISE NOTICE 'Added unique constraint for client_id and contract_type combination';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

-- Update existing data to use new enum values if needed
DO $$
DECLARE
    update_count integer;
BEGIN
    -- Update 'standard' to 'residential_address_check' if it exists
    IF EXISTS (SELECT 1 FROM public.client_contracts WHERE contract_type = 'standard') THEN
        UPDATE public.client_contracts 
        SET contract_type = 'residential_address_check' 
        WHERE contract_type = 'standard';
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Updated % rows from standard to residential_address_check', update_count;
    END IF;
    
    -- Update 'premium' to 'business_address_check' if it exists
    IF EXISTS (SELECT 1 FROM public.client_contracts WHERE contract_type = 'premium') THEN
        UPDATE public.client_contracts 
        SET contract_type = 'business_address_check' 
        WHERE contract_type = 'premium';
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Updated % rows from premium to business_address_check', update_count;
    END IF;
    
    -- Update other values to residential_address_check as default
    IF EXISTS (SELECT 1 FROM public.client_contracts WHERE contract_type NOT IN ('residential_address_check', 'business_address_check')) THEN
        UPDATE public.client_contracts 
        SET contract_type = 'residential_address_check' 
        WHERE contract_type NOT IN ('residential_address_check', 'business_address_check');
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Updated % rows to residential_address_check as default', update_count;
    END IF;
END $$;

-- Verify the changes
SELECT 'Verifying contract_type values:' as status;

-- Show current contract_type values in the table
SELECT DISTINCT contract_type, COUNT(*) as count
FROM public.client_contracts 
GROUP BY contract_type
ORDER BY contract_type;

-- Show unique constraint
SELECT 'Verifying unique constraint:' as status;

SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'client_contracts' 
AND constraint_name = 'unique_client_contract_type'
AND table_schema = 'public';
