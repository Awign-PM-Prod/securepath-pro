-- Query 1: Check the address stored in the locations table
-- Replace 'YOUR_CASE_ID' with the actual case ID that has the issue
-- Or use the case_number/client_case_id if you know it

SELECT 
    c.id as case_id,
    c.case_number,
    c.client_case_id,
    c.candidate_name,
    l.id as location_id,
    l.address_line,
    l.city,
    l.state,
    l.pincode,
    -- Check for special characters in address_line
    length(l.address_line) as address_length,
    encode(l.address_line::bytea, 'hex') as address_hex,
    -- Check if address contains problematic characters
    l.address_line ~ '[^\x20-\x7E\u00A0-\uFFFF]' as has_invalid_chars,
    position('\xFF' in l.address_line::bytea) > 0 as has_ff_char,
    position('\xFD' in l.address_line::bytea) > 0 as has_fd_char
FROM cases c
JOIN locations l ON c.location_id = l.id
WHERE c.case_number = 'YOUR_CASE_NUMBER'  -- Replace with actual case number
   OR c.client_case_id = 'YOUR_CLIENT_CASE_ID'  -- Or use client_case_id
   OR c.candidate_name LIKE '%Shibu%'  -- Or search by candidate name
ORDER BY c.created_at DESC
LIMIT 5;

-- Query 2: Check the address in form submission data (JSONB field)
-- This is what's actually displayed in the PDF report
SELECT 
    fs.id as submission_id,
    fs.case_id,
    c.case_number,
    c.client_case_id,
    fs.submission_data,
    -- Extract address-related fields from JSONB
    fs.submission_data->>'address' as address_field,
    fs.submission_data->>'current_residential_address' as current_address_field,
    fs.submission_data->>'applicant_address' as applicant_address_field,
    fs.submission_data->>'address_line' as address_line_field,
    -- Check all keys that might contain address
    jsonb_object_keys(fs.submission_data) as all_field_keys
FROM form_submissions fs
JOIN cases c ON fs.case_id = c.id
WHERE c.case_number = 'YOUR_CASE_NUMBER'  -- Replace with actual case number
   OR c.client_case_id = 'YOUR_CLIENT_CASE_ID'  -- Or use client_case_id
   OR c.candidate_name LIKE '%Shibu%'  -- Or search by candidate name
ORDER BY fs.created_at DESC
LIMIT 5;

-- Query 3: Find all address-related fields in submission_data for a specific case
-- This will show all possible address fields and their values
SELECT 
    c.case_number,
    c.client_case_id,
    fs.id as submission_id,
    key as field_key,
    value as field_value,
    jsonb_typeof(value) as value_type
FROM cases c
JOIN form_submissions fs ON c.id = fs.case_id
CROSS JOIN LATERAL jsonb_each(fs.submission_data) AS fields(key, value)
WHERE (c.case_number = 'YOUR_CASE_NUMBER'  -- Replace with actual case number
   OR c.client_case_id = 'YOUR_CLIENT_CASE_ID'  -- Or use client_case_id
   OR c.candidate_name LIKE '%Shibu%')  -- Or search by candidate name
  AND (key ILIKE '%address%' OR key ILIKE '%Address%')
ORDER BY fs.created_at DESC;

-- Query 4: Check for encoding issues in both locations and submission_data
-- This will help identify if the corruption is in storage or retrieval
SELECT 
    'locations table' as source,
    c.case_number,
    l.address_line,
    -- Check byte representation
    octet_length(l.address_line) as byte_length,
    -- Find position of problematic bytes
    position('\xFF'::bytea in l.address_line::bytea) as ff_position,
    position('\xFD'::bytea in l.address_line::bytea) as fd_position
FROM cases c
JOIN locations l ON c.location_id = l.id
WHERE c.case_number = 'YOUR_CASE_NUMBER'  -- Replace with actual case number
   OR c.client_case_id = 'YOUR_CLIENT_CASE_ID'
   OR c.candidate_name LIKE '%Shibu%'

UNION ALL

SELECT 
    'form_submissions JSONB' as source,
    c.case_number,
    fs.submission_data->>'address' as address_line,
    octet_length(fs.submission_data->>'address') as byte_length,
    position('\xFF'::bytea in (fs.submission_data->>'address')::bytea) as ff_position,
    position('\xFD'::bytea in (fs.submission_data->>'address')::bytea) as fd_position
FROM cases c
JOIN form_submissions fs ON c.id = fs.case_id
WHERE (c.case_number = 'YOUR_CASE_NUMBER'  -- Replace with actual case number
   OR c.client_case_id = 'YOUR_CLIENT_CASE_ID'
   OR c.candidate_name LIKE '%Shibu%')
  AND fs.submission_data ? 'address'
ORDER BY case_number;



















