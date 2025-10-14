-- =====================================================
-- Fix cases table to support both gig workers and vendors
-- Background Verification Platform
-- =====================================================

-- Drop the existing foreign key constraint that only allows gig_partners
ALTER TABLE public.cases 
DROP CONSTRAINT IF EXISTS cases_current_assignee_id_fkey;

-- The current_assignee_id field will now be a generic UUID that can reference either:
-- - gig_partners.id (when current_assignee_type = 'gig')
-- - vendors.id (when current_assignee_type = 'vendor')
-- We'll rely on application logic to ensure the correct references

-- Add a check constraint to ensure current_assignee_type is valid
ALTER TABLE public.cases 
ADD CONSTRAINT cases_current_assignee_type_check 
CHECK (current_assignee_type IN ('gig', 'vendor') OR current_assignee_type IS NULL);

-- Ensure current_vendor_id is set when current_assignee_type is 'vendor'
ALTER TABLE public.cases 
ADD CONSTRAINT cases_current_vendor_id_consistency_check 
CHECK (
    (current_assignee_type = 'vendor' AND current_vendor_id IS NOT NULL AND current_vendor_id = current_assignee_id) OR
    (current_assignee_type = 'gig' AND (current_vendor_id IS NULL OR current_vendor_id = current_assignee_id)) OR
    (current_assignee_id IS NULL)
);

-- Show the current table structure
SELECT 
    'cases table structure' as section,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'cases'
    AND column_name IN ('current_assignee_id', 'current_assignee_type', 'current_vendor_id')
ORDER BY column_name;
