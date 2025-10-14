-- =====================================================
-- Fix allocation_logs to support both gig workers and vendors
-- Background Verification Platform
-- =====================================================

-- Drop the existing foreign key constraint that only allows gig_partners
ALTER TABLE public.allocation_logs 
DROP CONSTRAINT IF EXISTS allocation_logs_candidate_id_fkey;

-- The candidate_id field will now be a generic UUID that can reference either:
-- - gig_partners.id (when candidate_type = 'gig')
-- - vendors.id (when candidate_type = 'vendor')
-- We'll rely on application logic to ensure the correct references

-- Add a check constraint to ensure candidate_type is valid
ALTER TABLE public.allocation_logs 
ADD CONSTRAINT allocation_logs_candidate_type_check 
CHECK (candidate_type IN ('gig', 'vendor'));

-- Ensure vendor_id is set when candidate_type is 'vendor'
ALTER TABLE public.allocation_logs 
ADD CONSTRAINT allocation_logs_vendor_id_consistency_check 
CHECK (
    (candidate_type = 'vendor' AND vendor_id IS NOT NULL AND vendor_id = candidate_id) OR
    (candidate_type = 'gig' AND (vendor_id IS NULL OR vendor_id = candidate_id))
);

-- Show the current table structure
SELECT 
    'allocation_logs table structure' as section,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'allocation_logs'
    AND column_name IN ('candidate_id', 'candidate_type', 'vendor_id')
ORDER BY column_name;
