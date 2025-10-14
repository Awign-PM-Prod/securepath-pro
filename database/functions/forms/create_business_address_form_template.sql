-- =====================================================
-- Business Address Check Form Template
-- =====================================================

-- Insert form template for business address check
INSERT INTO public.form_templates (contract_type_id, template_name, template_version, created_by)
SELECT 
    id as contract_type_id,
    'Business Address Verification Form' as template_name,
    1 as template_version,
    (SELECT id FROM auth.users WHERE email = 'admin@example.com' LIMIT 1) as created_by
FROM public.contract_type_config 
WHERE type_key = 'business_address_check';

-- Get the template ID for inserting fields
DO $$
DECLARE
    template_id_var UUID;
    field_order_counter INTEGER := 0;
BEGIN
    -- Get the template ID
    SELECT id INTO template_id_var 
    FROM public.form_templates 
    WHERE template_name = 'Business Address Verification Form' 
    AND template_version = 1;
    
    -- Insert form fields
    INSERT INTO public.form_fields (template_id, field_key, field_title, field_type, validation_type, field_order, field_config) VALUES
    
    -- Basic Access Questions
    (template_id_var, 'was_entry_allowed', 'Was entry allowed into the premises?', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1, 
     '{"options": ["Yes", "No"], "description": "Whether the verifier was allowed to enter the business premises"}'::jsonb),
    
    (template_id_var, 'premises_type', 'Type of Premises', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Office", "Shop", "Warehouse", "Factory", "Residential", "Mixed Use", "Other"], "description": "Type of business premises"}'::jsonb),
    
    (template_id_var, 'accessibility', 'Accessibility', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Easy", "Moderate", "Difficult", "Not Accessible"], "description": "How accessible is the premises"}'::jsonb),
    
    (template_id_var, 'surrounding_area', 'Surrounding Area', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Commercial", "Residential", "Industrial", "Mixed", "Remote"], "description": "Type of surrounding area"}'::jsonb),
    
    (template_id_var, 'area_serviceable', 'Is the area serviceable?', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Yes", "No"], "description": "Whether the area is serviceable for business operations"}'::jsonb),
    
    -- Contact Information
    (template_id_var, 'person_met_name', 'Name of Person Met', 'short_answer', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 100, "description": "Full name of the person met at the premises"}'::jsonb),
    
    (template_id_var, 'person_met_relation', 'Relation with Applicant', 'short_answer', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 50, "description": "Relationship of the person met with the applicant"}'::jsonb),
    
    (template_id_var, 'person_met_contact', 'Contact Number of Person Met', 'short_answer', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 15, "pattern": "^[0-9+\\-\\s()]+$", "description": "Contact number of the person met"}'::jsonb),
    
    -- Business Details
    (template_id_var, 'nature_of_business', 'Nature of Business', 'short_answer', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 200, "description": "Description of the business activities"}'::jsonb),
    
    (template_id_var, 'ownership_status', 'Ownership Status', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Owned", "Rented", "Leased", "Partnership", "Other"], "description": "Ownership status of the premises"}'::jsonb),
    
    (template_id_var, 'ownership_proof_verified', 'Ownership Proof Verified?', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Yes", "No", "Not Available"], "description": "Whether ownership proof was verified"}'::jsonb),
    
    (template_id_var, 'operating_duration', 'How long has the applicant been operating from this location?', 'short_answer', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 50, "description": "Duration of business operations at this location"}'::jsonb),
    
    -- Visual Verification
    (template_id_var, 'name_board_visible', 'Name board visible at site?', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Yes", "No", "Partially Visible"], "description": "Whether business name board is visible"}'::jsonb),
    
    (template_id_var, 'stock_observed', 'Was stock observed at the premises?', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Yes", "No", "Minimal"], "description": "Whether business stock was observed"}'::jsonb),
    
    (template_id_var, 'employee_count', 'No. of Employees', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["1-5", "6-10", "11-25", "26-50", "51-100", "100+"], "description": "Number of employees observed"}'::jsonb),
    
    (template_id_var, 'business_activity_level', 'Business Activity Level', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["High", "Medium", "Low", "No Activity"], "description": "Level of business activity observed"}'::jsonb),
    
    -- Third Party Verification
    (template_id_var, 'third_party_1_name', 'Third Party Name 1', 'short_answer', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 100, "description": "Name of first third party contacted"}'::jsonb),
    
    (template_id_var, 'third_party_1_status', 'Third Party 1 Status', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Confirmed", "Denied", "No Response", "Not Available"], "description": "Status of first third party verification"}'::jsonb),
    
    (template_id_var, 'third_party_1_remarks', 'Third Party 1 Remarks', 'paragraph', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 500, "description": "Remarks from first third party verification"}'::jsonb),
    
    (template_id_var, 'third_party_2_name', 'Third Party Name 2', 'short_answer', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 100, "description": "Name of second third party contacted"}'::jsonb),
    
    (template_id_var, 'third_party_2_status', 'Third Party 2 Status', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Confirmed", "Denied", "No Response", "Not Available"], "description": "Status of second third party verification"}'::jsonb),
    
    (template_id_var, 'third_party_2_remarks', 'Third Party 2 Remarks', 'paragraph', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 500, "description": "Remarks from second third party verification"}'::jsonb),
    
    -- Verification Details
    (template_id_var, 'verification_address_type', 'Was the business verified at the actual working address or registered address?', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Actual Working Address", "Registered Address", "Both"], "description": "Type of address where verification was conducted"}'::jsonb),
    
    (template_id_var, 'details_confirmed', 'Were all business details confirmed by the applicant?', 'multiple_choice', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"options": ["Yes", "No", "Partially"], "description": "Whether all business details were confirmed"}'::jsonb),
    
    (template_id_var, 'verifier_remarks', 'Remarks of Verifier', 'paragraph', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 1000, "description": "Overall remarks and observations of the verifier"}'::jsonb),
    
    (template_id_var, 'verified_by_name', 'Verified by (Name)', 'short_answer', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxLength": 100, "description": "Name of the person who conducted the verification"}'::jsonb),
    
    -- File Uploads
    (template_id_var, 'signature_upload', 'Signature Upload', 'file_upload', 'optional', field_order_counter := field_order_counter + 1,
     '{"maxFiles": 1, "allowedTypes": ["image/jpeg", "image/png", "application/pdf"], "maxSizeMB": 5, "description": "Upload signature of the person met"}'::jsonb),
    
    (template_id_var, 'agency_supervisor_signature', 'Agency Supervisor Signature', 'file_upload', 'optional', field_order_counter := field_order_counter + 1,
     '{"maxFiles": 1, "allowedTypes": ["image/jpeg", "image/png", "application/pdf"], "maxSizeMB": 5, "description": "Upload agency supervisor signature"}'::jsonb),
    
    -- Photo Requirements
    (template_id_var, 'selfie_with_customer', 'Selfie Image with Customer', 'file_upload', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxFiles": 1, "allowedTypes": ["image/jpeg", "image/png"], "maxSizeMB": 10, "description": "Selfie photo with the customer/person met"}'::jsonb),
    
    (template_id_var, 'inside_office_pics', 'Inside Pics of Office', 'file_upload', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxFiles": 3, "allowedTypes": ["image/jpeg", "image/png"], "maxSizeMB": 10, "description": "Photos of the inside of the office (minimum 3 photos)"}'::jsonb),
    
    (template_id_var, 'outside_office_photo', 'Outside Photo of Office', 'file_upload', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxFiles": 2, "allowedTypes": ["image/jpeg", "image/png"], "maxSizeMB": 10, "description": "Photos of the outside of the office (minimum 2 photos)"}'::jsonb),
    
    (template_id_var, 'company_board_image', 'Company Board Image', 'file_upload', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxFiles": 1, "allowedTypes": ["image/jpeg", "image/png"], "maxSizeMB": 10, "description": "Photo of the company name board/signage"}'::jsonb),
    
    (template_id_var, 'stock_photo', 'Stock Photo', 'file_upload', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxFiles": 5, "allowedTypes": ["image/jpeg", "image/png"], "maxSizeMB": 10, "description": "Photos of business stock/inventory (minimum 5 photos)"}'::jsonb),
    
    (template_id_var, 'landmark_image', 'Landmark Image', 'file_upload', 'mandatory', field_order_counter := field_order_counter + 1,
     '{"maxFiles": 2, "allowedTypes": ["image/jpeg", "image/png"], "maxSizeMB": 10, "description": "Photos of nearby landmarks (minimum 2 photos)"}'::jsonb);
    
    RAISE NOTICE 'Business Address Check form template created with % fields', field_order_counter;
END $$;
