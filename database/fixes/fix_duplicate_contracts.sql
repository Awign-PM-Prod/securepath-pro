-- Fix duplicate client contracts before running migration
-- Run this script first to clean up duplicates

-- 1. Check for duplicates
SELECT 
    'Checking for duplicates:' as status,
    client_id, 
    contract_type, 
    COUNT(*) as duplicate_count
FROM public.client_contracts 
GROUP BY client_id, contract_type
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Show details of duplicates
SELECT 
    'Duplicate details:' as status,
    id,
    client_id,
    contract_type,
    created_at,
    updated_at
FROM public.client_contracts 
WHERE (client_id, contract_type) IN (
    SELECT client_id, contract_type
    FROM public.client_contracts 
    GROUP BY client_id, contract_type
    HAVING COUNT(*) > 1
)
ORDER BY client_id, contract_type, created_at DESC;

-- 3. Delete duplicates (keeping only the most recent one)
-- WARNING: This will delete duplicate records!
DELETE FROM public.client_contracts 
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (PARTITION BY client_id, contract_type ORDER BY created_at DESC) as rn
        FROM public.client_contracts
    ) ranked
    WHERE rn > 1
);

-- 4. Verify no duplicates remain
SELECT 
    'Verification - remaining duplicates:' as status,
    client_id, 
    contract_type, 
    COUNT(*) as count
FROM public.client_contracts 
GROUP BY client_id, contract_type
HAVING COUNT(*) > 1;

-- 5. Show final state
SELECT 
    'Final state:' as status,
    COUNT(*) as total_contracts,
    COUNT(DISTINCT client_id) as unique_clients,
    COUNT(DISTINCT contract_type) as unique_contract_types
FROM public.client_contracts;
