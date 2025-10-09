-- =====================================================
-- Test Gig Worker Creation
-- This will help us verify the function is working correctly
-- =====================================================

-- First, let's check if the function exists and what parameters it expects
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'create_gig_worker_profile' 
AND routine_schema = 'public';

-- Check the function parameters
SELECT 
  parameter_name,
  data_type,
  parameter_default
FROM information_schema.parameters 
WHERE specific_name = (
  SELECT specific_name 
  FROM information_schema.routines 
  WHERE routine_name = 'create_gig_worker_profile' 
  AND routine_schema = 'public'
)
ORDER BY ordinal_position;

-- Test the function with sample data
SELECT public.create_gig_worker_profile(
  'John',           -- first_name
  'Doe',            -- last_name  
  'john.doe@example.com',  -- email
  '9876543210',     -- phone
  '123 Test Street', -- address
  'Bangalore',     -- city
  'Karnataka',      -- state
  '560001',         -- pincode
  NULL,             -- alternate_phone
  'India',          -- country
  ARRAY['560001', '560002'], -- coverage_pincodes
  5,                -- max_daily_capacity
  NULL,             -- vendor_id
  true,             -- is_direct_gig
  true,             -- is_active
  true,             -- is_available
  auth.uid()        -- created_by
) as new_gig_worker_id;

-- Check if the profile was created correctly
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.role,
  p.is_active
FROM public.profiles p
WHERE p.first_name = 'John' 
AND p.last_name = 'Doe'
ORDER BY p.created_at DESC
LIMIT 1;

-- Check if the gig_partner was created correctly
SELECT 
  gp.id,
  gp.profile_id,
  gp.phone,
  gp.address,
  gp.city,
  gp.state,
  gp.pincode,
  gp.max_daily_capacity,
  gp.is_direct_gig,
  gp.is_active,
  gp.is_available
FROM public.gig_partners gp
JOIN public.profiles p ON gp.profile_id = p.id
WHERE p.first_name = 'John' 
AND p.last_name = 'Doe'
ORDER BY gp.created_at DESC
LIMIT 1;

-- Check if capacity tracking was initialized
SELECT 
  ct.gig_partner_id,
  ct.date,
  ct.max_daily_capacity,
  ct.initial_capacity_available,
  ct.current_capacity_available,
  ct.is_active
FROM public.capacity_tracking ct
JOIN public.gig_partners gp ON ct.gig_partner_id = gp.id
JOIN public.profiles p ON gp.profile_id = p.id
WHERE p.first_name = 'John' 
AND p.last_name = 'Doe'
ORDER BY ct.created_at DESC
LIMIT 1;
