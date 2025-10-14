-- Fix gig worker access to cases (RLS policies only)
-- This script only fixes RLS policies without creating test data

-- First, let's check what case statuses and assignment types actually exist
DO $$
DECLARE
  case_count integer;
  status_counts record;
  assignment_counts record;
BEGIN
  SELECT COUNT(*) INTO case_count FROM public.cases;
  RAISE NOTICE 'Total cases: %', case_count;
  
  -- Show count for each status
  RAISE NOTICE 'Case statuses:';
  FOR status_counts IN 
    SELECT status, COUNT(*) as count 
    FROM public.cases 
    GROUP BY status 
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  Status "%": % cases', status_counts.status, status_counts.count;
  END LOOP;
  
  -- Show count for each assignment type
  RAISE NOTICE 'Assignment types:';
  FOR assignment_counts IN 
    SELECT current_assignee_type, COUNT(*) as count 
    FROM public.cases 
    WHERE current_assignee_type IS NOT NULL
    GROUP BY current_assignee_type 
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  Assignment type "%": % cases', assignment_counts.current_assignee_type, assignment_counts.count;
  END LOOP;
END $$;

-- Ensure RLS policies allow gig workers to view their assigned cases
DROP POLICY IF EXISTS "Users can view cases they are assigned to" ON public.cases;
DROP POLICY IF EXISTS "Gig workers can view their assigned cases" ON public.cases;

CREATE POLICY "Gig workers can view their assigned cases"
ON public.cases 
FOR SELECT
TO authenticated
USING (
  -- Gig workers can view cases assigned to them
  (current_assignee_type = 'gig' AND current_assignee_id IN (
    SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
  )) OR
  -- Super admins can view all
  (has_role('super_admin')) OR
  -- Ops team can view all
  (has_role('ops_team')) OR
  -- Vendor team can view all
  (has_role('vendor_team')) OR
  -- Vendors can view cases assigned to their gig workers
  (has_role('vendor') AND current_assignee_type = 'gig' AND current_assignee_id IN (
    SELECT gp.id FROM public.gig_partners gp
    JOIN public.vendors v ON gp.vendor_id = v.id
    WHERE v.created_by = auth.uid()
  ))
);

-- Also allow gig workers to update their assigned cases
DROP POLICY IF EXISTS "Gig workers can update their assigned cases" ON public.cases;

CREATE POLICY "Gig workers can update their assigned cases"
ON public.cases 
FOR UPDATE
TO authenticated
USING (
  -- Gig workers can update cases assigned to them
  (current_assignee_type = 'gig' AND current_assignee_id IN (
    SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
  )) OR
  -- Super admins can update all
  (has_role('super_admin')) OR
  -- Ops team can update all
  (has_role('ops_team')) OR
  -- Vendor team can update all
  (has_role('vendor_team'))
);

-- Test the access
DO $$
DECLARE
  test_gig_worker_id uuid;
  test_user_id uuid;
  case_count integer;
BEGIN
  -- Get a test gig worker
  SELECT gp.id, gp.user_id 
  INTO test_gig_worker_id, test_user_id
  FROM public.gig_partners gp
  JOIN public.profiles p ON gp.profile_id = p.id
  WHERE p.role = 'gig_worker'
  LIMIT 1;
  
  IF test_gig_worker_id IS NOT NULL THEN
    -- Count cases assigned to this gig worker
    SELECT COUNT(*) INTO case_count 
    FROM public.cases 
    WHERE current_assignee_id = test_gig_worker_id;
    
    RAISE NOTICE 'Gig worker test results:';
    RAISE NOTICE '  Gig Worker ID: %', test_gig_worker_id;
    RAISE NOTICE '  User ID: %', test_user_id;
    RAISE NOTICE '  Assigned cases: %', case_count;
    
    -- Show case details
    IF case_count > 0 THEN
      RAISE NOTICE 'Case details:';
      FOR rec IN 
        SELECT case_number, title, status, priority, base_rate_inr, current_assignee_type
        FROM public.cases 
        WHERE current_assignee_id = test_gig_worker_id
        LIMIT 3
      LOOP
        RAISE NOTICE '  - %: % (%) - % - ₹% - %', 
          rec.case_number, rec.title, rec.status, rec.priority, rec.base_rate_inr, rec.current_assignee_type;
      END LOOP;
    END IF;
  ELSE
    RAISE NOTICE 'No gig workers found for testing';
  END IF;
END $$;

RAISE NOTICE 'Gig worker access policies updated successfully!';
