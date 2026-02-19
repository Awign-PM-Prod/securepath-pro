-- =====================================================
-- SQL Queries to Run in Supabase SQL Editor
-- Add allocation_method field to cases table
-- =====================================================
-- 
-- INSTRUCTIONS:
-- 1. Copy and paste each section below into Supabase SQL Editor
-- 2. Run them in order (one at a time or all together)
-- 3. Verify the changes after running
-- =====================================================

-- =====================================================
-- STEP 1: Create enum type for allocation method
-- =====================================================
CREATE TYPE public.allocation_method AS ENUM (
  'auto',
  'manual'
);

-- =====================================================
-- STEP 2: Add allocation_method column to cases table
-- =====================================================
ALTER TABLE public.cases 
ADD COLUMN allocation_method public.allocation_method;

-- =====================================================
-- STEP 3: Add comment for documentation
-- =====================================================
COMMENT ON COLUMN public.cases.allocation_method IS 'Indicates whether the case was allocated automatically by the allocation engine or manually by ops team';

-- =====================================================
-- STEP 4: Create index for better query performance
-- =====================================================
CREATE INDEX idx_cases_allocation_method ON public.cases(allocation_method);

-- =====================================================
-- STEP 5: Backfill existing cases based on allocation_logs and current_assignee_id
-- This updates cases that are already allocated
-- =====================================================
UPDATE public.cases c
SET allocation_method = CASE
  -- First priority: Check allocation_logs for explicit manual allocation
  WHEN EXISTS (
    SELECT 1 
    FROM public.allocation_logs al 
    WHERE al.case_id = c.id 
      AND al.decision = 'allocated'
      AND al.score_snapshot->>'manual_allocation' = 'true'
  ) THEN 'manual'::public.allocation_method
  -- Second priority: Check allocation_logs for any allocation (assumed auto)
  WHEN EXISTS (
    SELECT 1 
    FROM public.allocation_logs al 
    WHERE al.case_id = c.id 
      AND al.decision = 'allocated'
  ) THEN 'auto'::public.allocation_method
  -- Third priority: If case has assignee but no logs, check status
  -- 'auto_allocated' status indicates auto allocation
  WHEN c.current_assignee_id IS NOT NULL 
    AND c.status = 'auto_allocated' 
  THEN 'auto'::public.allocation_method
  -- Fourth priority: If case has assignee and is in allocated/post-allocated statuses, 
  -- assume manual (most historical cases without logs were manually allocated)
  WHEN c.current_assignee_id IS NOT NULL 
    AND c.status IN ('allocated', 'accepted', 'in_progress', 'submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'completed', 'in_payment_cycle', 'payment_complete')
  THEN 'manual'::public.allocation_method
  -- Keep NULL for cases that haven't been allocated yet
  ELSE NULL
END
WHERE c.current_assignee_id IS NOT NULL 
   OR c.status IN ('allocated', 'auto_allocated', 'accepted', 'in_progress', 'submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'completed', 'in_payment_cycle', 'payment_complete');

-- =====================================================
-- STEP 6: Update allocate_case_to_candidate function
-- This ensures auto allocation sets allocation_method = 'auto'
-- =====================================================
CREATE OR REPLACE FUNCTION allocate_case_to_candidate(
    p_case_id UUID,
    p_candidate_id UUID,
    p_candidate_type TEXT,
    p_vendor_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    case_exists BOOLEAN;
    candidate_exists BOOLEAN;
    vendor_exists BOOLEAN;
BEGIN
    -- Check if case exists
    SELECT EXISTS(SELECT 1 FROM cases WHERE id = p_case_id) INTO case_exists;
    IF NOT case_exists THEN
        RAISE EXCEPTION 'Case not found: %', p_case_id;
    END IF;
    
    -- Check if candidate exists
    IF p_candidate_type = 'gig' THEN
        SELECT EXISTS(SELECT 1 FROM gig_partners WHERE id = p_candidate_id) INTO candidate_exists;
    ELSIF p_candidate_type = 'vendor' THEN
        SELECT EXISTS(SELECT 1 FROM vendors WHERE id = p_candidate_id) INTO candidate_exists;
    ELSE
        RAISE EXCEPTION 'Invalid candidate type: %', p_candidate_type;
    END IF;
    
    IF NOT candidate_exists THEN
        RAISE EXCEPTION 'Candidate not found: %', p_candidate_id;
    END IF;
    
    -- Update case assignment
    UPDATE cases 
    SET 
        current_assignee_id = p_candidate_id,
        current_assignee_type = p_candidate_type::assignment_type,
        current_vendor_id = CASE 
            WHEN p_candidate_type = 'vendor' THEN p_candidate_id
            ELSE p_vendor_id
        END,
        status = 'allocated',
        allocation_method = 'auto',
        status_updated_at = now()
    WHERE id = p_case_id;
    
    -- Update capacity for gig workers
    IF p_candidate_type = 'gig' THEN
        UPDATE gig_partners 
        SET 
            capacity_available = GREATEST(0, capacity_available - 1),
            active_cases_count = active_cases_count + 1,
            last_assignment_at = now()
        WHERE id = p_candidate_id;
        
        -- Update vendor capacity if gig worker belongs to a vendor
        IF p_vendor_id IS NOT NULL THEN
            UPDATE vendors 
            SET 
                capacity_available = GREATEST(0, capacity_available - 1),
                active_cases_count = active_cases_count + 1
            WHERE id = p_vendor_id;
        END IF;
    END IF;
    
    -- Update capacity for vendors
    IF p_candidate_type = 'vendor' THEN
        UPDATE vendors 
        SET 
            capacity_available = GREATEST(0, capacity_available - 1),
            active_cases_count = active_cases_count + 1,
            total_cases_assigned = total_cases_assigned + 1
        WHERE id = p_candidate_id;
    END IF;
    
    -- Log allocation
    INSERT INTO allocation_logs (
        case_id,
        candidate_id,
        candidate_type,
        vendor_id,
        allocated_at,
        acceptance_deadline,
        score_snapshot,
        created_by
    ) VALUES (
        p_case_id,
        p_candidate_id,
        p_candidate_type::assignment_type,
        COALESCE(p_vendor_id, CASE WHEN p_candidate_type = 'vendor' THEN p_candidate_id ELSE NULL END),
        now(),
        now() + interval '30 minutes',
        '{}'::jsonb,
        auth.uid()
    );
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Allocation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 7: Update auto_allocation_with_vendors function
-- This ensures bulk auto allocation sets allocation_method = 'auto'
-- =====================================================
CREATE OR REPLACE FUNCTION auto_allocation_with_vendors(
  p_pincode TEXT,
  p_case_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
  candidate RECORD;
  case_id UUID;
  allocation_count INTEGER := 0;
  failed_count INTEGER := 0;
  result JSONB;
  case_count INTEGER;
BEGIN
  case_count := array_length(p_case_ids, 1);
  
  -- Get the best candidate for this pincode
  SELECT * INTO candidate
  FROM public.get_allocation_candidates_with_vendors(p_pincode, case_count)
  LIMIT 1;
  
  IF candidate IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No suitable candidates found for allocation',
      'allocated_count', 0,
      'failed_count', case_count
    );
  END IF;
  
  -- Allocate each case
  FOREACH case_id IN ARRAY p_case_ids
  LOOP
    BEGIN
      IF candidate.candidate_type = 'gig_worker' THEN
        -- Allocate to gig worker
        UPDATE public.cases
        SET 
          current_assignee_id = candidate.candidate_id,
          current_assignee_type = 'gig',
          current_vendor_id = candidate.vendor_id,
          status = 'allocated',
          allocation_method = 'auto',
          status_updated_at = now()
        WHERE id = case_id;
        
        -- Update gig worker capacity
        UPDATE public.gig_partners
        SET 
          capacity_available = capacity_available - 1,
          active_cases_count = active_cases_count + 1
        WHERE id = candidate.candidate_id;
        
        allocation_count := allocation_count + 1;
        
      ELSIF candidate.candidate_type = 'vendor' THEN
        -- Allocate to vendor
        UPDATE public.cases
        SET 
          current_vendor_id = candidate.candidate_id,
          current_assignee_type = 'vendor',
          status = 'allocated',
          allocation_method = 'auto',
          status_updated_at = now()
        WHERE id = case_id;
        
        -- Update vendor capacity
        UPDATE public.vendors
        SET 
          capacity_available = capacity_available - 1,
          active_cases_count = active_cases_count + 1
        WHERE id = candidate.candidate_id;
        
        allocation_count := allocation_count + 1;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        failed_count := failed_count + 1;
        RAISE WARNING 'Failed to allocate case %: %', case_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'allocated_count', allocation_count,
    'failed_count', failed_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 8: Update assign_case_to_gig_worker for QC Rework
-- This ensures QC rework allocations are marked as manual
-- =====================================================

-- Drop the existing function first (in case it has different parameter defaults)
-- CASCADE will also drop any dependent objects
DROP FUNCTION IF EXISTS assign_case_to_gig_worker(UUID, UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION assign_case_to_gig_worker(
    p_case_id UUID,
    p_gig_worker_id UUID,
    p_vendor_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    gig_worker_vendor_id UUID;
    case_status TEXT;
    rework_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the gig worker's vendor_id
    SELECT vendor_id INTO gig_worker_vendor_id
    FROM gig_partners 
    WHERE id = p_gig_worker_id;
    
    -- Check if the gig worker belongs to the vendor
    IF gig_worker_vendor_id IS NULL OR gig_worker_vendor_id != p_vendor_id THEN
        RAISE EXCEPTION 'Gig worker does not belong to the specified vendor';
    END IF;
    
    -- Get current case status
    SELECT status INTO case_status
    FROM cases 
    WHERE id = p_case_id;
    
    -- For QC rework cases, set status to 'allocated' and add 30-minute timer
    IF case_status = 'qc_rework' THEN
        rework_deadline := NOW() + INTERVAL '30 minutes';
        
        UPDATE cases 
        SET 
            current_assignee_id = p_gig_worker_id,
            current_assignee_type = 'gig',
            current_vendor_id = p_vendor_id,
            status = 'allocated',
            allocation_method = 'manual',
            status_updated_at = NOW(),
            due_at = rework_deadline
        WHERE id = p_case_id;
    ELSE
        -- For other cases, use the existing logic
        UPDATE cases 
        SET 
            current_assignee_id = p_gig_worker_id,
            current_assignee_type = 'gig',
            current_vendor_id = p_vendor_id,
            status = 'accepted',
            status_updated_at = NOW()
        WHERE id = p_case_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_case_to_gig_worker(UUID, UUID, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify the changes
-- =====================================================

-- Check if the enum type was created
SELECT typname, typtype 
FROM pg_type 
WHERE typname = 'allocation_method';

-- Check if the column was added
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'cases' 
  AND column_name = 'allocation_method';

-- Check allocation_method distribution
SELECT 
  allocation_method,
  COUNT(*) as case_count
FROM public.cases
GROUP BY allocation_method;

-- Check which cases have null allocation_method and their statuses
-- This helps identify cases that need backfilling
SELECT 
  status,
  COUNT(*) as case_count,
  COUNT(CASE WHEN current_assignee_id IS NOT NULL THEN 1 END) as cases_with_assignee,
  COUNT(CASE WHEN current_assignee_id IS NULL THEN 1 END) as cases_without_assignee
FROM public.cases
WHERE allocation_method IS NULL
GROUP BY status
ORDER BY case_count DESC;

-- Check cases with allocation_method set
SELECT 
  id,
  case_number,
  status,
  allocation_method,
  current_assignee_id
FROM public.cases
WHERE allocation_method IS NOT NULL
LIMIT 10;

-- =====================================================
-- ADDITIONAL FIX: Update remaining null cases
-- Run this if you still have null values after Step 5
-- =====================================================
-- This query updates cases that still have NULL allocation_method
-- but have been allocated (have assignee or are in post-allocation statuses)
-- NOTE: These are set to 'manual' as they were allocated before allocation_logs were implemented
UPDATE public.cases c
SET allocation_method = 'manual'::public.allocation_method
WHERE c.allocation_method IS NULL
  AND (
    c.current_assignee_id IS NOT NULL 
    OR c.status IN ('allocated', 'auto_allocated', 'accepted', 'in_progress', 'submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'completed', 'in_payment_cycle', 'payment_complete')
  );

-- =====================================================
-- CORRECTION: Change cases that were incorrectly set to 'auto' to 'manual'
-- Run this to fix cases that were set to 'auto' but should be 'manual'
-- =====================================================
-- Update cases that were set to 'auto' but don't have allocation_logs
-- These were likely manually allocated before allocation_logs were implemented
UPDATE public.cases c
SET allocation_method = 'manual'::public.allocation_method
WHERE c.allocation_method = 'auto'::public.allocation_method
  AND NOT EXISTS (
    SELECT 1 
    FROM public.allocation_logs al 
    WHERE al.case_id = c.id 
      AND al.decision = 'allocated'
  )
  AND (
    c.current_assignee_id IS NOT NULL 
    OR c.status IN ('allocated', 'auto_allocated', 'accepted', 'in_progress', 'submitted', 'qc_passed', 'qc_rejected', 'qc_rework', 'reported', 'completed', 'in_payment_cycle', 'payment_complete')
  );

