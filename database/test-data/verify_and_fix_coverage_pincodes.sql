-- =====================================================
-- Verify and Fix Coverage Pincodes
-- =====================================================

-- This script ensures workers have proper coverage pincodes set up

-- Step 1: Check current coverage setup
SELECT 
  'Current Coverage Setup' as info,
  p.email,
  gp.coverage_pincodes,
  array_length(gp.coverage_pincodes, 1) as coverage_count,
  gp.city,
  gp.state,
  gp.pincode as worker_pincode
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE gp.is_active = true
ORDER BY p.email;

-- Step 2: Check what pincodes exist in the system
SELECT 
  'Available Pincodes in System' as info,
  l.pincode,
  l.city,
  l.state,
  l.pincode_tier,
  COUNT(*) as case_count
FROM public.locations l
LEFT JOIN public.cases c ON l.id = c.location_id
GROUP BY l.pincode, l.city, l.state, l.pincode_tier
ORDER BY l.pincode;

-- Step 3: Add common pincodes to workers who don't have coverage
-- First, let's add some common test pincodes to workers
UPDATE public.gig_partners 
SET 
  coverage_pincodes = ARRAY['400058', '560001', '110001', '700001', '600001', '500001', '800001', '700001', '300001', '200001'],
  updated_at = now()
WHERE is_active = true 
  AND (coverage_pincodes IS NULL OR array_length(coverage_pincodes, 1) = 0);

-- Step 4: Add worker's own pincode to their coverage if not already included
UPDATE public.gig_partners 
SET 
  coverage_pincodes = CASE 
    WHEN pincode IS NOT NULL AND NOT (pincode = ANY(coverage_pincodes)) THEN 
      array_append(coverage_pincodes, pincode)
    ELSE coverage_pincodes
  END,
  updated_at = now()
WHERE is_active = true 
  AND pincode IS NOT NULL;

-- Step 5: Add nearby pincodes based on city/state
UPDATE public.gig_partners 
SET 
  coverage_pincodes = CASE 
    WHEN city = 'Mumbai' AND NOT ('400001' = ANY(coverage_pincodes)) THEN 
      array_cat(coverage_pincodes, ARRAY['400001', '400002', '400003', '400004', '400005'])
    WHEN city = 'Delhi' AND NOT ('110001' = ANY(coverage_pincodes)) THEN 
      array_cat(coverage_pincodes, ARRAY['110001', '110002', '110003', '110004', '110005'])
    WHEN city = 'Bangalore' AND NOT ('560001' = ANY(coverage_pincodes)) THEN 
      array_cat(coverage_pincodes, ARRAY['560001', '560002', '560003', '560004', '560005'])
    WHEN city = 'Kolkata' AND NOT ('700001' = ANY(coverage_pincodes)) THEN 
      array_cat(coverage_pincodes, ARRAY['700001', '700002', '700003', '700004', '700005'])
    WHEN city = 'Chennai' AND NOT ('600001' = ANY(coverage_pincodes)) THEN 
      array_cat(coverage_pincodes, ARRAY['600001', '600002', '600003', '600004', '600005'])
    WHEN city = 'Hyderabad' AND NOT ('500001' = ANY(coverage_pincodes)) THEN 
      array_cat(coverage_pincodes, ARRAY['500001', '500002', '500003', '500004', '500005'])
    WHEN city = 'Pune' AND NOT ('411001' = ANY(coverage_pincodes)) THEN 
      array_cat(coverage_pincodes, ARRAY['411001', '411002', '411003', '411004', '411005'])
    WHEN city = 'Ahmedabad' AND NOT ('380001' = ANY(coverage_pincodes)) THEN 
      array_cat(coverage_pincodes, ARRAY['380001', '380002', '380003', '380004', '380005'])
    ELSE coverage_pincodes
  END,
  updated_at = now()
WHERE is_active = true;

-- Step 6: Verify updated coverage
SELECT 
  'Updated Coverage Setup' as info,
  p.email,
  gp.coverage_pincodes,
  array_length(gp.coverage_pincodes, 1) as coverage_count,
  gp.city,
  gp.state
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE gp.is_active = true
ORDER BY p.email;

-- Step 7: Test allocation for specific pincodes
SELECT 
  'Allocation Test Results' as info,
  test_pincode,
  COUNT(*) as eligible_workers,
  STRING_AGG(worker_email, ', ') as worker_emails
FROM (
  SELECT '400058' as test_pincode
  UNION ALL SELECT '560001'
  UNION ALL SELECT '110001'
  UNION ALL SELECT '700001'
) test_pincodes
CROSS JOIN LATERAL (
  SELECT p.email as worker_email
  FROM public.get_allocation_candidates(
    gen_random_uuid(),
    test_pincodes.test_pincode,
    'tier_1'::pincode_tier
  ) ac
  JOIN public.gig_partners gp ON ac.gig_partner_id = gp.id
  JOIN public.profiles p ON gp.profile_id = p.id
) workers
GROUP BY test_pincode
ORDER BY test_pincode;

-- Step 8: Show detailed coverage for test5@worker.com
SELECT 
  'test5@worker.com Coverage Details' as info,
  p.email,
  gp.coverage_pincodes,
  gp.capacity_available,
  gp.max_daily_capacity,
  CASE 
    WHEN '400058' = ANY(gp.coverage_pincodes) THEN 'COVERS_400058'
    ELSE 'DOES_NOT_COVER_400058'
  END as covers_test_pincode
FROM public.profiles p
JOIN public.gig_partners gp ON p.id = gp.profile_id
WHERE p.email = 'test5@worker.com';
