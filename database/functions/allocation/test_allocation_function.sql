-- =====================================================
-- Test Allocation Function - Debug Version
-- Background Verification Platform
-- =====================================================

-- First, let's see what data we actually have
SELECT '=== GIG WORKERS DATA ===' as info;

SELECT 
    id,
    is_direct_gig,
    is_active,
    is_available,
    capacity_available,
    quality_score,
    completion_rate,
    ontime_completion_rate,
    acceptance_rate,
    coverage_pincodes,
    pincode
FROM gig_partners 
WHERE is_active = true
LIMIT 5;

SELECT '=== VENDORS DATA ===' as info;

SELECT 
    id,
    is_active,
    capacity_available,
    quality_score,
    performance_score,
    coverage_pincodes,
    pincode
FROM vendors 
WHERE is_active = true
LIMIT 5;

SELECT '=== PINCODE TIERS DATA ===' as info;

SELECT 
    pincode,
    tier,
    city,
    state
FROM pincode_tiers 
LIMIT 5;

-- Now let's test the allocation function step by step
SELECT '=== TESTING ALLOCATION FUNCTION ===' as info;

-- Test with a specific case
SELECT 
    'Allocation Test Results' as info,
    candidate_id,
    candidate_type,
    candidate_name,
    quality_score,
    completion_rate,
    ontime_completion_rate,
    acceptance_rate,
    capacity_available,
    is_direct_gig,
    coverage_pincodes,
    performance_score
FROM get_allocation_candidates(
    '00000000-0000-0000-0000-000000000000'::UUID,
    '560001',
    'tier_1'
)
LIMIT 10;

-- Let's also test with different pincodes
SELECT '=== TESTING WITH DIFFERENT PINCODES ===' as info;

SELECT 
    'Pincode 560102' as test_pincode,
    COUNT(*) as candidate_count
FROM get_allocation_candidates(
    '00000000-0000-0000-0000-000000000000'::UUID,
    '560102',
    'tier_1'
);

SELECT 
    'Pincode 560038' as test_pincode,
    COUNT(*) as candidate_count
FROM get_allocation_candidates(
    '00000000-0000-0000-0000-000000000000'::UUID,
    '560038',
    'tier_2'
);

-- Let's check what happens if we remove all conditions
SELECT '=== TESTING WITHOUT CONDITIONS ===' as info;

-- Test gig workers without any conditions
SELECT 
    'Gig Workers - No Conditions' as test_type,
    COUNT(*) as count
FROM gig_partners gp
JOIN profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true;

-- Test gig workers with basic conditions
SELECT 
    'Gig Workers - Basic Conditions' as test_type,
    COUNT(*) as count
FROM gig_partners gp
JOIN profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true 
  AND gp.is_available = true
  AND gp.is_direct_gig = true
  AND gp.capacity_available > 0;

-- Test gig workers with pincode matching
SELECT 
    'Gig Workers - With Pincode Match' as test_type,
    COUNT(*) as count
FROM gig_partners gp
JOIN profiles p ON gp.profile_id = p.id
WHERE gp.is_active = true 
  AND gp.is_available = true
  AND gp.is_direct_gig = true
  AND gp.capacity_available > 0
  AND ('560001' = ANY(gp.coverage_pincodes) OR gp.coverage_pincodes @> ARRAY['560001'] OR gp.coverage_pincodes = '{}' OR array_length(gp.coverage_pincodes, 1) IS NULL);

-- Test vendors
SELECT 
    'Vendors - Basic Conditions' as test_type,
    COUNT(*) as count
FROM vendors v
WHERE v.is_active = true
  AND v.capacity_available > 0;
