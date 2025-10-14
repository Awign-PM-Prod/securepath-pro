-- =====================================================
-- Fix allocation_logs foreign key constraints for vendor support
-- Background Verification Platform
-- =====================================================

-- First, let's check the current foreign key constraints
SELECT 
    'Current Foreign Key Constraints' as section,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'allocation_logs'
    AND kcu.column_name = 'candidate_id';

-- Drop the existing foreign key constraint that only allows gig_partners
ALTER TABLE public.allocation_logs 
DROP CONSTRAINT IF EXISTS allocation_logs_candidate_id_fkey;

-- Create a new foreign key constraint that allows both gig_partners and vendors
-- We'll use a check constraint approach since we can't have a single FK to multiple tables
-- Instead, we'll make the constraint conditional based on candidate_type

-- Add a check constraint to ensure candidate_id exists in the appropriate table
ALTER TABLE public.allocation_logs 
ADD CONSTRAINT allocation_logs_candidate_id_check 
CHECK (
    (candidate_type = 'gig' AND candidate_id IN (SELECT id FROM public.gig_partners)) OR
    (candidate_type = 'vendor' AND candidate_id IN (SELECT id FROM public.vendors))
);

-- Also ensure vendor_id is set when candidate_type is 'vendor'
ALTER TABLE public.allocation_logs 
ADD CONSTRAINT allocation_logs_vendor_id_check 
CHECK (
    (candidate_type = 'vendor' AND vendor_id IS NOT NULL AND vendor_id = candidate_id) OR
    (candidate_type = 'gig' AND vendor_id IS NULL)
);

-- Show the updated constraints
SELECT 
    'Updated Constraints' as section,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    cc.check_clause
FROM information_schema.table_constraints AS tc
LEFT JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.check_constraints AS cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.table_schema = cc.table_schema
WHERE tc.table_name = 'allocation_logs'
    AND (tc.constraint_type = 'FOREIGN KEY' OR tc.constraint_type = 'CHECK')
ORDER BY tc.constraint_name;
