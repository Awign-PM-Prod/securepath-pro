-- Test RLS policies for vendor access to form submissions
-- Run this as the vendor user to see if they can access the data

-- First, check if the vendor can see the case
SELECT 
  c.id as case_id,
  c.case_number,
  c.current_vendor_id,
  v.id as vendor_id,
  v.name as vendor_name,
  p.user_id,
  p.role
FROM cases c
JOIN vendors v ON c.current_vendor_id = v.id
JOIN profiles p ON v.profile_id = p.id
WHERE c.id = '0fcaa032-8171-4636-8e32-d1a0956b2f4b';

-- Check if there are any form submissions for this case
SELECT 
  fs.id,
  fs.case_id,
  fs.gig_partner_id,
  fs.status,
  fs.created_at
FROM form_submissions fs
WHERE fs.case_id = '0fcaa032-8171-4636-8e32-d1a0956b2f4b';

-- Check if there are any legacy submissions for this case
SELECT 
  s.id,
  s.case_id,
  s.gig_partner_id,
  s.status,
  s.created_at
FROM submissions s
WHERE s.case_id = '0fcaa032-8171-4636-8e32-d1a0956b2f4b';

-- Check the gig worker who submitted this case
SELECT 
  gp.id as gig_partner_id,
  gp.vendor_id,
  gp.is_direct_gig,
  p.first_name,
  p.last_name,
  p.user_id
FROM gig_partners gp
JOIN profiles p ON gp.user_id = p.user_id
WHERE gp.id = 'f15f95f9-dfe6-4b4f-867f-813f9a02d15b';
