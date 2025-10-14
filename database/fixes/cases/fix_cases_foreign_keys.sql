-- =====================================================
-- Fix cases table foreign key constraints for vendor support
-- Background Verification Platform
-- =====================================================

-- First, let's check the current foreign key constraints on cases table
SELECT 
    'Current Foreign Key Constraints on cases' as section,
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
    AND tc.table_name = 'cases'
    AND kcu.column_name IN ('current_assignee_id', 'current_vendor_id');

-- Drop the existing foreign key constraint that only allows gig_partners
ALTER TABLE public.cases 
DROP CONSTRAINT IF EXISTS cases_current_assignee_id_fkey;

-- Add check constraints to ensure data integrity
-- current_assignee_id should reference the appropriate table based on current_assignee_type
ALTER TABLE public.cases 
ADD CONSTRAINT cases_current_assignee_id_check 
CHECK (
    (current_assignee_type = 'gig' AND current_assignee_id IN (SELECT id FROM public.gig_partners)) OR
    (current_assignee_type = 'vendor' AND current_assignee_id IN (SELECT id FROM public.vendors)) OR
    (current_assignee_id IS NULL)
);

-- Ensure current_vendor_id is set when current_assignee_type is 'vendor'
ALTER TABLE public.cases 
ADD CONSTRAINT cases_current_vendor_id_check 
CHECK (
    (current_assignee_type = 'vendor' AND current_vendor_id IS NOT NULL AND current_vendor_id = current_assignee_id) OR
    (current_assignee_type = 'gig' AND (current_vendor_id IS NULL OR current_vendor_id = current_assignee_id)) OR
    (current_assignee_id IS NULL)
);

-- Show the updated constraints
SELECT 
    'Updated Constraints on cases' as section,
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
WHERE tc.table_name = 'cases'
    AND (tc.constraint_type = 'FOREIGN KEY' OR tc.constraint_type = 'CHECK')
    AND (kcu.column_name IN ('current_assignee_id', 'current_vendor_id') OR cc.constraint_name LIKE '%current_assignee%' OR cc.constraint_name LIKE '%current_vendor%')
ORDER BY tc.constraint_name;
