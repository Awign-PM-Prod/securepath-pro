-- =====================================================
-- Fix Allocation Data Issues
-- Background Verification Platform
-- =====================================================

-- First, let's check what data we have
SELECT 'Current Data Status' as info;

-- Check gig workers
SELECT 
    'Gig Workers' as type,
    COUNT(*) as total,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active,
    COUNT(CASE WHEN is_direct_gig = true THEN 1 END) as direct_gig,
    COUNT(CASE WHEN capacity_available > 0 THEN 1 END) as with_capacity,
    COUNT(CASE WHEN coverage_pincodes IS NOT NULL AND array_length(coverage_pincodes, 1) > 0 THEN 1 END) as with_coverage
FROM gig_partners;

-- Check vendors
SELECT 
    'Vendors' as type,
    COUNT(*) as total,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active,
    COUNT(CASE WHEN capacity_available > 0 THEN 1 END) as with_capacity,
    COUNT(CASE WHEN coverage_pincodes IS NOT NULL AND array_length(coverage_pincodes, 1) > 0 THEN 1 END) as with_coverage
FROM vendors;

-- Check pincode tiers
SELECT 
    'Pincode Tiers' as type,
    COUNT(*) as total,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active
FROM pincode_tiers;

-- Fix gig workers - ensure they have proper coverage pincodes
UPDATE gig_partners 
SET coverage_pincodes = ARRAY[pincode]
WHERE (coverage_pincodes IS NULL OR coverage_pincodes = '{}' OR array_length(coverage_pincodes, 1) IS NULL)
  AND pincode IS NOT NULL;

-- Fix vendors - ensure they have proper coverage pincodes
UPDATE vendors 
SET coverage_pincodes = ARRAY[pincode]
WHERE (coverage_pincodes IS NULL OR coverage_pincodes = '{}' OR array_length(coverage_pincodes, 1) IS NULL)
  AND pincode IS NOT NULL;

-- Ensure all gig workers have reasonable performance scores
UPDATE gig_partners 
SET 
    quality_score = GREATEST(0.5, COALESCE(quality_score, 0)),
    completion_rate = GREATEST(0.5, COALESCE(completion_rate, 0)),
    ontime_completion_rate = GREATEST(0.5, COALESCE(ontime_completion_rate, 0)),
    acceptance_rate = GREATEST(0.5, COALESCE(acceptance_rate, 0))
WHERE is_active = true;

-- Ensure all vendors have reasonable performance scores
UPDATE vendors 
SET 
    quality_score = GREATEST(0.5, COALESCE(quality_score, 0)),
    performance_score = GREATEST(0.5, COALESCE(performance_score, 0))
WHERE is_active = true;

-- Ensure all gig workers have capacity
UPDATE gig_partners 
SET capacity_available = GREATEST(1, capacity_available)
WHERE is_active = true AND capacity_available <= 0;

-- Ensure all vendors have capacity
UPDATE vendors 
SET capacity_available = GREATEST(1, capacity_available)
WHERE is_active = true AND capacity_available <= 0;

-- Create some test pincode tiers if they don't exist
INSERT INTO pincode_tiers (pincode, tier, city, state, is_active, created_by)
SELECT 
    '560001' as pincode,
    'tier_1' as tier,
    'Bangalore' as city,
    'Karnataka' as state,
    true as is_active,
    (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1) as created_by
WHERE NOT EXISTS (SELECT 1 FROM pincode_tiers WHERE pincode = '560001');

INSERT INTO pincode_tiers (pincode, tier, city, state, is_active, created_by)
SELECT 
    '560102' as pincode,
    'tier_1' as tier,
    'Bangalore' as city,
    'Karnataka' as state,
    true as is_active,
    (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1) as created_by
WHERE NOT EXISTS (SELECT 1 FROM pincode_tiers WHERE pincode = '560102');

INSERT INTO pincode_tiers (pincode, tier, city, state, is_active, created_by)
SELECT 
    '560038' as pincode,
    'tier_2' as tier,
    'Bangalore' as city,
    'Karnataka' as state,
    true as is_active,
    (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1) as created_by
WHERE NOT EXISTS (SELECT 1 FROM pincode_tiers WHERE pincode = '560038');

-- Update locations to have proper pincode tiers
UPDATE locations 
SET pincode_tier = pt.tier
FROM pincode_tiers pt
WHERE locations.pincode = pt.pincode
  AND locations.pincode_tier IS NULL;

-- Check the results
SELECT 'After Fixes' as info;

-- Check gig workers again
SELECT 
    'Gig Workers After Fix' as type,
    COUNT(*) as total,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active,
    COUNT(CASE WHEN is_direct_gig = true THEN 1 END) as direct_gig,
    COUNT(CASE WHEN capacity_available > 0 THEN 1 END) as with_capacity,
    COUNT(CASE WHEN coverage_pincodes IS NOT NULL AND array_length(coverage_pincodes, 1) > 0 THEN 1 END) as with_coverage
FROM gig_partners;

-- Check vendors again
SELECT 
    'Vendors After Fix' as type,
    COUNT(*) as total,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active,
    COUNT(CASE WHEN capacity_available > 0 THEN 1 END) as with_capacity,
    COUNT(CASE WHEN coverage_pincodes IS NOT NULL AND array_length(coverage_pincodes, 1) > 0 THEN 1 END) as with_coverage
FROM vendors;

-- Test allocation with a sample case
SELECT 'Testing allocation with sample case...' as info;

SELECT 
    candidate_id,
    candidate_type,
    candidate_name,
    quality_score,
    completion_rate,
    capacity_available,
    coverage_pincodes
FROM get_allocation_candidates(
    '00000000-0000-0000-0000-000000000000'::UUID,
    '560001',
    'tier_1'
)
LIMIT 5;
