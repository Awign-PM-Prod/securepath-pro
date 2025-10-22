-- Test case edit functionality
-- This script tests if case editing works properly after the fixes

-- First, let's check if we can fetch a case for editing
SELECT 'Testing case fetch for edit...' as test_step;

-- Get a sample case to test with
SELECT 
  c.id,
  c.case_number,
  c.status,
  c.client_case_id,
  c.contract_type,
  c.candidate_name,
  c.phone_primary,
  l.address_line,
  l.city,
  l.state,
  l.pincode
FROM public.cases c
LEFT JOIN public.locations l ON c.location_id = l.id
WHERE c.status IN ('new', 'allocated', 'accepted', 'in_progress')
LIMIT 1;

-- Test if we can update a case (simulate the update)
SELECT 'Testing case update simulation...' as test_step;

-- Test a simple case update (just update metadata to avoid affecting status)
UPDATE public.cases 
SET 
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb), 
    '{test_edit}', 
    to_jsonb(now()::text)
  ),
  updated_at = now()
WHERE id IN (
  SELECT id FROM public.cases 
  WHERE status IN ('new', 'allocated', 'accepted', 'in_progress')
  LIMIT 1
)
RETURNING id, case_number, status, updated_at;

-- Check current case status enum values
SELECT 'Current case_status enum values:' as info;
SELECT unnest(enum_range(NULL::case_status)) as enum_values;

-- Check if there are any cases with invalid status values
SELECT 'Cases with potentially invalid status values:' as info;
SELECT status, COUNT(*) as count
FROM public.cases 
GROUP BY status 
ORDER BY count DESC;

-- Test authentication by checking if we can access the cases table
SELECT 'Testing authentication access...' as test_step;

-- This should work if RLS is properly configured
SELECT COUNT(*) as total_cases FROM public.cases;

-- Check RLS policies on cases table
SELECT 'Current RLS policies on cases table:' as info;
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual
FROM pg_policies 
WHERE tablename = 'cases' 
AND schemaname = 'public'
ORDER BY policyname;

-- Check if RLS is enabled
SELECT 'RLS status on cases table:' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'cases' 
AND schemaname = 'public';
