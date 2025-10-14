-- =====================================================
-- Debug Allocation Candidates
-- Background Verification Platform
-- =====================================================

-- First, let's check if we have any gig workers and vendors
SELECT 'Gig Workers Count' as type, COUNT(*) as count FROM gig_partners WHERE is_active = true
UNION ALL
SELECT 'Vendors Count' as type, COUNT(*) as count FROM vendors WHERE is_active = true
UNION ALL
SELECT 'Direct Gig Workers' as type, COUNT(*) as count FROM gig_partners WHERE is_active = true AND is_direct_gig = true
UNION ALL
SELECT 'Gig Workers with Capacity' as type, COUNT(*) as count FROM gig_partners WHERE is_active = true AND capacity_available > 0
UNION ALL
SELECT 'Vendors with Capacity' as type, COUNT(*) as count FROM vendors WHERE is_active = true AND capacity_available > 0;

-- Check some sample gig workers
SELECT 
    'Sample Gig Workers' as info,
    id,
    is_direct_gig,
    is_active,
    is_available,
    capacity_available,
    quality_score,
    completion_rate,
    ontime_completion_rate,
    acceptance_rate,
    coverage_pincodes
FROM gig_partners 
WHERE is_active = true 
LIMIT 5;

-- Check some sample vendors
SELECT 
    'Sample Vendors' as info,
    id,
    is_active,
    capacity_available,
    quality_score,
    performance_score,
    coverage_pincodes
FROM vendors 
WHERE is_active = true 
LIMIT 5;

-- Check pincode tiers
SELECT 
    'Sample Pincode Tiers' as info,
    pincode,
    tier,
    city,
    state
FROM pincode_tiers 
LIMIT 10;

-- Test the allocation function with a sample case
SELECT 
    'Testing Allocation Function' as info,
    candidate_id,
    candidate_type,
    candidate_name,
    quality_score,
    completion_rate,
    ontime_completion_rate,
    acceptance_rate,
    capacity_available,
    is_direct_gig,
    performance_score
FROM get_allocation_candidates(
    '00000000-0000-0000-0000-000000000000'::UUID,
    '560001',
    'tier_1'
)
LIMIT 10;
