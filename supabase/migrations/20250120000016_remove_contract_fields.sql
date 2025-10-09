-- Remove contract_number, contract_name, start_date, end_date from client_contracts table
-- These fields are no longer needed for the simplified contract structure

-- Remove the specified columns from client_contracts table
DO $$ 
BEGIN
    -- Remove contract_number column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'contract_number' AND table_schema = 'public') THEN
        ALTER TABLE public.client_contracts DROP COLUMN contract_number;
        RAISE NOTICE 'Removed contract_number column from client_contracts';
    END IF;
    
    -- Remove contract_name column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'contract_name' AND table_schema = 'public') THEN
        ALTER TABLE public.client_contracts DROP COLUMN contract_name;
        RAISE NOTICE 'Removed contract_name column from client_contracts';
    END IF;
    
    -- Remove start_date column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'start_date' AND table_schema = 'public') THEN
        ALTER TABLE public.client_contracts DROP COLUMN start_date;
        RAISE NOTICE 'Removed start_date column from client_contracts';
    END IF;
    
    -- Remove end_date column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_contracts' AND column_name = 'end_date' AND table_schema = 'public') THEN
        ALTER TABLE public.client_contracts DROP COLUMN end_date;
        RAISE NOTICE 'Removed end_date column from client_contracts';
    END IF;
END $$;

-- Verify the columns have been removed
SELECT 'Verifying removed columns:' as status;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_contracts' 
AND table_schema = 'public'
AND column_name IN ('contract_number', 'contract_name', 'start_date', 'end_date')
ORDER BY column_name;

-- Show the updated table structure
SELECT 'Updated client_contracts table structure:' as status;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'client_contracts' 
AND table_schema = 'public'
ORDER BY ordinal_position;
