-- =====================================================
-- Safely fix foreign key constraints for vendor support
-- Background Verification Platform
-- =====================================================

-- Fix allocation_logs table
-- Drop existing foreign key constraint if it exists
ALTER TABLE public.allocation_logs 
DROP CONSTRAINT IF EXISTS allocation_logs_candidate_id_fkey;

-- Add candidate_type check constraint only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'allocation_logs_candidate_type_check'
        AND table_name = 'allocation_logs'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.allocation_logs 
        ADD CONSTRAINT allocation_logs_candidate_type_check 
        CHECK (candidate_type IN ('gig', 'vendor'));
    END IF;
END $$;

-- Add vendor_id consistency check only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'allocation_logs_vendor_id_consistency_check'
        AND table_name = 'allocation_logs'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.allocation_logs 
        ADD CONSTRAINT allocation_logs_vendor_id_consistency_check 
        CHECK (
            (candidate_type = 'vendor' AND vendor_id IS NOT NULL AND vendor_id = candidate_id) OR
            (candidate_type = 'gig' AND (vendor_id IS NULL OR vendor_id = candidate_id))
        );
    END IF;
END $$;

-- Fix cases table
-- Drop existing foreign key constraint if it exists
ALTER TABLE public.cases 
DROP CONSTRAINT IF EXISTS cases_current_assignee_id_fkey;

-- Add current_assignee_type check constraint only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'cases_current_assignee_type_check'
        AND table_name = 'cases'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.cases 
        ADD CONSTRAINT cases_current_assignee_type_check 
        CHECK (current_assignee_type IN ('gig', 'vendor') OR current_assignee_type IS NULL);
    END IF;
END $$;

-- Add current_vendor_id consistency check only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'cases_current_vendor_id_consistency_check'
        AND table_name = 'cases'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.cases 
        ADD CONSTRAINT cases_current_vendor_id_consistency_check 
        CHECK (
            (current_assignee_type = 'vendor' AND current_vendor_id IS NOT NULL AND current_vendor_id = current_assignee_id) OR
            (current_assignee_type = 'gig' AND (current_vendor_id IS NULL OR current_vendor_id = current_assignee_id)) OR
            (current_assignee_id IS NULL)
        );
    END IF;
END $$;

-- Show the current constraints
SELECT 
    'Current Constraints' as section,
    tc.constraint_name,
    tc.table_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints AS tc
LEFT JOIN information_schema.check_constraints AS cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.table_schema = cc.table_schema
WHERE tc.table_name IN ('allocation_logs', 'cases')
    AND tc.table_schema = 'public'
    AND (tc.constraint_type = 'CHECK' OR tc.constraint_name LIKE '%candidate%' OR tc.constraint_name LIKE '%assignee%' OR tc.constraint_name LIKE '%vendor%')
ORDER BY tc.table_name, tc.constraint_name;
