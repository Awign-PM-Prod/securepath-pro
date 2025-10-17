-- Create both Residence Verification and Business Verification contract types
-- Run this script to create both forms

-- Create Residence Verification Contract Type
\i database/functions/forms/create_residence_verification_contract_type.sql

-- Create Business Verification Contract Type  
\i database/functions/forms/create_business_verification_contract_type.sql

-- Verify both contract types were created
SELECT 
    ct.name as contract_type_name,
    ct.description,
    COUNT(fs.id) as section_count,
    COUNT(ff.id) as field_count
FROM contract_types ct
LEFT JOIN form_sections fs ON ct.id = fs.contract_type_id
LEFT JOIN form_fields ff ON fs.id = ff.section_id
WHERE ct.name IN ('Residence Verification', 'Business Verification')
GROUP BY ct.id, ct.name, ct.description
ORDER BY ct.name;
