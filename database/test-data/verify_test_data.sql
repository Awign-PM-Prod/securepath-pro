-- =====================================================
-- Verify Test Data Setup
-- =====================================================

-- This script verifies that the test data was created correctly
-- Run this script in your Supabase SQL editor to check the data

-- Check gig workers
SELECT 
  'Gig Workers' as table_name,
  COUNT(*) as count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM public.gig_partners;

-- Check profiles
SELECT 
  'Profiles' as table_name,
  COUNT(*) as count,
  COUNT(CASE WHEN role = 'gig_worker' THEN 1 END) as gig_worker_count
FROM public.profiles;

-- Check cases
SELECT 
  'Cases' as table_name,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'created' THEN 1 END) as created_count
FROM public.cases;

-- Check locations
SELECT 
  'Locations' as table_name,
  COUNT(*) as count,
  COUNT(CASE WHEN pincode_tier = 'tier_1' THEN 1 END) as tier_1_count,
  COUNT(CASE WHEN pincode_tier = 'tier_2' THEN 1 END) as tier_2_count
FROM public.locations;

-- Check clients
SELECT 
  'Clients' as table_name,
  COUNT(*) as count
FROM public.clients;

-- Check client contracts
SELECT 
  'Client Contracts' as table_name,
  COUNT(*) as count
FROM public.client_contracts;

-- Check capacity tracking
SELECT 
  'Capacity Tracking' as table_name,
  COUNT(*) as count
FROM public.capacity_tracking;

-- Check performance metrics
SELECT 
  'Performance Metrics' as table_name,
  COUNT(*) as count
FROM public.performance_metrics;

-- Detailed gig worker information
SELECT 
  'Gig Workers by City' as info,
  gp.city,
  COUNT(*) as worker_count,
  SUM(gp.max_daily_capacity) as total_capacity,
  SUM(gp.capacity_available) as available_capacity
FROM public.gig_partners gp
WHERE gp.is_active = true
GROUP BY gp.city
ORDER BY total_capacity DESC;

-- Cases by pincode tier
SELECT 
  'Cases by Pincode Tier' as info,
  l.pincode_tier,
  COUNT(*) as case_count
FROM public.cases c
JOIN public.locations l ON c.location_id = l.id
GROUP BY l.pincode_tier
ORDER BY case_count DESC;

-- Cases by status
SELECT 
  'Cases by Status' as info,
  status,
  COUNT(*) as count
FROM public.cases
GROUP BY status
ORDER BY count DESC;

-- Test the relationship between cases and client contracts
SELECT 
  'Case-Client-Contract Relationship' as info,
  c.case_number,
  cl.name as client_name,
  cc.contract_type
FROM public.cases c
JOIN public.clients cl ON c.client_id = cl.id
JOIN public.client_contracts cc ON cl.id = cc.client_id
LIMIT 5;
