-- Create Business Verification Contract Type
-- Based on successful_business_qc_approved_csv_dump fields

-- Insert the contract type
INSERT INTO contract_types (
    id,
    name,
    description,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'Business Verification',
    'Comprehensive business verification form with company details, staff information, and photo documentation',
    true,
    NOW(),
    NOW()
) ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = NOW()
RETURNING id;

-- Get the contract type ID and create form sections
DO $$
DECLARE
    contract_type_id UUID;
    basic_info_section_id UUID;
    business_details_section_id UUID;
    address_section_id UUID;
    verification_section_id UUID;
    photo_documentation_section_id UUID;
    neighbor_feedback_section_id UUID;
    field_executive_section_id UUID;
BEGIN
    -- Get the contract type ID
    SELECT id INTO contract_type_id 
    FROM contract_types 
    WHERE name = 'Business Verification';
    
    -- Create form sections
    INSERT INTO form_sections (id, contract_type_id, title, description, order_index, is_active)
    VALUES 
    (gen_random_uuid(), contract_type_id, 'Basic Information', 'Company and applicant details', 1, true),
    (gen_random_uuid(), contract_type_id, 'Business Details', 'Nature of business and operations', 2, true),
    (gen_random_uuid(), contract_type_id, 'Address & Location', 'Office address and location details', 3, true),
    (gen_random_uuid(), contract_type_id, 'Verification Details', 'Visit and verification information', 4, true),
    (gen_random_uuid(), contract_type_id, 'Photo Documentation', 'Required photographs and evidence', 5, true),
    (gen_random_uuid(), contract_type_id, 'Neighbor Feedback', 'Neighbor verification and feedback', 6, true),
    (gen_random_uuid(), contract_type_id, 'Field Executive Details', 'Field executive information and comments', 7, true)
    RETURNING id INTO basic_info_section_id;
    
    -- Get section IDs
    SELECT id INTO basic_info_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Basic Information';
    SELECT id INTO business_details_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Business Details';
    SELECT id INTO address_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Address & Location';
    SELECT id INTO verification_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Verification Details';
    SELECT id INTO photo_documentation_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Photo Documentation';
    SELECT id INTO neighbor_feedback_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Neighbor Feedback';
    SELECT id INTO field_executive_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Field Executive Details';
    
    -- Basic Information Fields
    INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
    VALUES 
    (gen_random_uuid(), basic_info_section_id, 'lead_id', 'Lead ID', 'text', true, 1, '{"maxLength": 50}', null),
    (gen_random_uuid(), basic_info_section_id, 'company_name', 'Company Name', 'text', true, 2, '{"maxLength": 200}', null),
    (gen_random_uuid(), basic_info_section_id, 'applicant_name', 'Applicant Name', 'text', true, 3, '{"maxLength": 100}', null),
    (gen_random_uuid(), basic_info_section_id, 'contact_no', 'Contact Number', 'phone', true, 4, '{"pattern": "^[0-9]{10}$"}', null),
    (gen_random_uuid(), basic_info_section_id, 'co_applicant_founder_name', 'Co-Applicant/Founder Name', 'text', false, 5, '{"maxLength": 100}', null),
    (gen_random_uuid(), basic_info_section_id, 'city', 'City', 'text', true, 6, '{"maxLength": 50}', null),
    (gen_random_uuid(), basic_info_section_id, 'fi_type', 'FI Type', 'select', true, 7, null, '[{"label": "Business", "value": "business"}, {"label": "Office", "value": "office"}, {"label": "Residence", "value": "residence"}]'),
    (gen_random_uuid(), basic_info_section_id, 'is_there_some_one_avilable_to_assist_you', 'Is someone available to assist?', 'radio', true, 8, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), basic_info_section_id, 'selfie_image', 'Selfie Image Required', 'radio', true, 9, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]');
    
    -- Business Details Fields
    INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
    VALUES 
    (gen_random_uuid(), business_details_section_id, 'nature_of_business', 'Nature of Business', 'text', true, 1, '{"maxLength": 200}', null),
    (gen_random_uuid(), business_details_section_id, 'type_of_business_set_up', 'Type of Business Setup', 'select', true, 2, null, '[{"label": "Sole Proprietorship", "value": "sole_proprietorship"}, {"label": "Partnership", "value": "partnership"}, {"label": "Private Limited", "value": "private_limited"}, {"label": "Public Limited", "value": "public_limited"}, {"label": "LLP", "value": "llp"}, {"label": "Other", "value": "other"}]'),
    (gen_random_uuid(), business_details_section_id, 'description_of_the_business_activity_seen', 'Description of Business Activity Seen', 'textarea', true, 3, '{"maxLength": 1000}', null),
    (gen_random_uuid(), business_details_section_id, 'stock_level_at_the_time_of_visit', 'Stock Level at Time of Visit', 'select', true, 4, null, '[{"label": "High", "value": "high"}, {"label": "Medium", "value": "medium"}, {"label": "Low", "value": "low"}, {"label": "Empty", "value": "empty"}]'),
    (gen_random_uuid(), business_details_section_id, 'no_of_employees_as_confirmed_by_the_person_met', 'Number of Employees (Confirmed)', 'number', true, 5, '{"min": 0, "max": 10000}', null),
    (gen_random_uuid(), business_details_section_id, 'no_of_employees_seen_during_the_visit', 'Number of Employees (Seen)', 'number', true, 6, '{"min": 0, "max": 10000}', null),
    (gen_random_uuid(), business_details_section_id, 'no_of_company_employees_working_from_home_remote', 'Number of Remote Employees', 'number', false, 7, '{"min": 0, "max": 10000}', null),
    (gen_random_uuid(), business_details_section_id, 'is_authorised_person_director_available', 'Is Authorized Person/Director Available', 'radio', true, 8, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), business_details_section_id, 'office_space_area_in_sq_feet', 'Office Space Area (sq ft)', 'number', true, 9, '{"min": 1, "max": 100000}', null),
    (gen_random_uuid(), business_details_section_id, 'construction_type', 'Construction Type', 'select', true, 10, null, '[{"label": "RCC", "value": "rcc"}, {"label": "Brick", "value": "brick"}, {"label": "Wooden", "value": "wooden"}, {"label": "Temporary", "value": "temporary"}, {"label": "Other", "value": "other"}]'),
    (gen_random_uuid(), business_details_section_id, 'is_society_given_permission_to_run_the_business_from_the_flat', 'Society Permission for Business', 'radio', false, 11, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}, {"label": "Not Applicable", "value": "not_applicable"}]'),
    (gen_random_uuid(), business_details_section_id, 'is_the_property_owned_or_leased', 'Property Status', 'select', true, 12, null, '[{"label": "Owned", "value": "owned"}, {"label": "Leased", "value": "leased"}, {"label": "Rented", "value": "rented"}]'),
    (gen_random_uuid(), business_details_section_id, 'operating_at_this_address_since_month_year', 'Operating at Address Since', 'text', true, 13, '{"maxLength": 50}', null),
    (gen_random_uuid(), business_details_section_id, 'working_hours_of_the_evaluated_entity', 'Working Hours', 'text', true, 14, '{"maxLength": 100}', null);
    
    -- Address & Location Fields
    INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
    VALUES 
    (gen_random_uuid(), address_section_id, 'current_office_address', 'Current Office Address', 'textarea', true, 1, '{"maxLength": 500}', null),
    (gen_random_uuid(), address_section_id, 'address', 'Address', 'textarea', true, 2, '{"maxLength": 500}', null),
    (gen_random_uuid(), address_section_id, 'pin_code', 'PIN Code', 'text', true, 3, '{"pattern": "^[0-9]{6}$"}', null),
    (gen_random_uuid(), address_section_id, 'pin_code_area', 'PIN Code Area', 'text', true, 4, '{"maxLength": 100}', null),
    (gen_random_uuid(), address_section_id, 'what_type_of_locality_is_the_customer_operating_from', 'Type of Locality', 'select', true, 5, null, '[{"label": "Commercial", "value": "commercial"}, {"label": "Residential", "value": "residential"}, {"label": "Industrial", "value": "industrial"}, {"label": "Mixed", "value": "mixed"}]'),
    (gen_random_uuid(), address_section_id, 'ease_of_locating_commuting_address', 'Ease of Locating Address', 'select', true, 6, null, '[{"label": "Easy", "value": "easy"}, {"label": "Moderate", "value": "moderate"}, {"label": "Difficult", "value": "difficult"}]'),
    (gen_random_uuid(), address_section_id, 'landmark', 'Landmark', 'text', true, 7, '{"maxLength": 200}', null),
    (gen_random_uuid(), address_section_id, 'is_entry_allowed_in_the_office', 'Is Entry Allowed in Office', 'radio', true, 8, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]');
    
    -- Verification Details Fields
    INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
    VALUES 
    (gen_random_uuid(), verification_section_id, 'name_of_person_met', 'Name of Person Met', 'text', true, 1, '{"maxLength": 100}', null),
    (gen_random_uuid(), verification_section_id, 'designation_of_met_person', 'Designation of Person Met', 'text', true, 2, '{"maxLength": 100}', null),
    (gen_random_uuid(), verification_section_id, 'person_present_at_the_premises_have_knowledge_of_the_borrower_or_business', 'Person Has Knowledge of Business', 'radio', true, 3, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), verification_section_id, 'if_details_are_mismatched_enter_correct_details', 'If Details Mismatched, Enter Correct Details', 'textarea', false, 4, '{"maxLength": 1000}', null);
    
    -- Photo Documentation Fields
    INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
    VALUES 
    (gen_random_uuid(), photo_documentation_section_id, 'is_office_shop_establishment_license_proof_captured', 'Office/Shop License Proof Captured', 'radio', true, 1, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), photo_documentation_section_id, 'is_outside_photograph_of_business_shop_obtained_with_latitude_longitude', 'Outside Photo with GPS', 'radio', true, 2, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), photo_documentation_section_id, 'is_inside_photograph_of_business_shop_obtained_with_latitude_longitude', 'Inside Photo with GPS', 'radio', true, 3, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), photo_documentation_section_id, 'is_photograph_of_staff_in_the_shop_captured', 'Staff Photo Captured', 'radio', true, 4, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), photo_documentation_section_id, 'is_neighborhood_photo_captured', 'Neighborhood Photo Captured', 'radio', true, 5, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), photo_documentation_section_id, 'is_the_photograph_of_the_business_activity_captured', 'Business Activity Photo Captured', 'radio', true, 6, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), photo_documentation_section_id, 'is_board_name_photograph_captured', 'Board Name Photo Captured', 'radio', true, 7, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), photo_documentation_section_id, 'is_the_rent_agreement_rented_property_or_electricity_bill_of_past_6th_month_owned_property_captured', 'Rent Agreement/Electricity Bill Captured', 'radio', true, 8, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), photo_documentation_section_id, 'gst_certificate_photo', 'GST Certificate Photo', 'file', false, 9, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'name_plate_photo', 'Name Plate Photo', 'file', true, 10, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'main_door_reception_area', 'Main Door/Reception Area Photo', 'file', true, 11, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'building_photo', 'Building Photo', 'file', true, 12, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'working_area_photo', 'Working Area Photo', 'file', true, 13, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'address_proof_photo', 'Address Proof Photo', 'file', false, 14, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'stock_photo', 'Stock Photo', 'file', true, 15, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'selfie_image', 'Selfie Image', 'file', false, 16, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'landmark_photo', 'Landmark Photo', 'file', true, 17, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'society_noc_certificate', 'Society NOC Certificate', 'file', false, 18, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
    (gen_random_uuid(), photo_documentation_section_id, 'main_door_photo', 'Main Door Photo', 'file', true, 19, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null);
    
    -- Neighbor Feedback Fields
    INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
    VALUES 
    (gen_random_uuid(), neighbor_feedback_section_id, 'tatement_of_neighbour', 'Statement of Neighbor', 'textarea', false, 1, '{"maxLength": 1000}', null),
    (gen_random_uuid(), neighbor_feedback_section_id, 'name_of_the_person_met_neighbour_1', 'Name of Person Met (Neighbor 1)', 'text', false, 2, '{"maxLength": 100}', null),
    (gen_random_uuid(), neighbor_feedback_section_id, 'is_the_neighbor_aware_of_the_business_being_operated_from_the_premises_neighbour_1', 'Neighbor 1 - Aware of Business', 'radio', false, 3, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), neighbor_feedback_section_id, 'how_long_has_the_company_been_operational_from_this_location_neighbour_1', 'Neighbor 1 - How Long Operational', 'text', false, 4, '{"maxLength": 100}', null),
    (gen_random_uuid(), neighbor_feedback_section_id, 'do_the_owners_regularly_visit_the_premises_neighbour_1', 'Neighbor 1 - Owners Visit Regularly', 'radio', false, 5, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), neighbor_feedback_section_id, 'has_there_been_any_suspicious_activity_tax_raids_or_employee_issues_neighbour_1', 'Neighbor 1 - Any Suspicious Activity', 'radio', false, 6, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), neighbor_feedback_section_id, 'name_of_the_person_met_neighbour_2', 'Name of Person Met (Neighbor 2)', 'text', false, 7, '{"maxLength": 100}', null),
    (gen_random_uuid(), neighbor_feedback_section_id, 'is_the_neighbor_aware_of_the_business_being_operated_from_the_premises_neighbour_2', 'Neighbor 2 - Aware of Business', 'radio', false, 8, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), neighbor_feedback_section_id, 'how_long_has_the_company_been_operational_from_this_location_neighbour_2', 'Neighbor 2 - How Long Operational', 'text', false, 9, '{"maxLength": 100}', null),
    (gen_random_uuid(), neighbor_feedback_section_id, 'do_the_owners_regularly_visit_the_premises_neighbour_2', 'Neighbor 2 - Owners Visit Regularly', 'radio', false, 10, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), neighbor_feedback_section_id, 'is_the_premises_operational_on_a_daily_basis_neighbour_2', 'Neighbor 2 - Daily Operations', 'radio', false, 11, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), neighbor_feedback_section_id, 'has_there_been_any_suspicious_activity_tax_raids_or_employee_issues_neighbour_2', 'Neighbor 2 - Any Suspicious Activity', 'radio', false, 12, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
    (gen_random_uuid(), neighbor_feedback_section_id, 'field_executive_comments_on_neighbours_feedback', 'Field Executive Comments on Neighbor Feedback', 'textarea', false, 13, '{"maxLength": 1000}', null);
    
    -- Field Executive Details Fields
    INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
    VALUES 
    (gen_random_uuid(), field_executive_section_id, 'field_executive_name', 'Field Executive Name', 'text', true, 1, '{"maxLength": 100}', null),
    (gen_random_uuid(), field_executive_section_id, 'date_and_time_of_visit', 'Date and Time of Visit', 'datetime', true, 2, null, null),
    (gen_random_uuid(), field_executive_section_id, 'latitude_and_longitude', 'Latitude and Longitude', 'text', true, 3, '{"pattern": "^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?),\\s*[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$"}', null),
    (gen_random_uuid(), field_executive_section_id, 'check_severity', 'Check Severity', 'select', true, 4, null, '[{"label": "Low", "value": "low"}, {"label": "Medium", "value": "medium"}, {"label": "High", "value": "high"}, {"label": "Critical", "value": "critical"}]'),
    (gen_random_uuid(), field_executive_section_id, 'final_disposition_if_report_is_positive', 'Final Disposition', 'select', true, 5, null, '[{"label": "Positive", "value": "positive"}, {"label": "Negative", "value": "negative"}, {"label": "Inconclusive", "value": "inconclusive"}]'),
    (gen_random_uuid(), field_executive_section_id, 'field_executive_comments_if_met_someone', 'Field Executive Comments', 'textarea', false, 6, '{"maxLength": 1000}', null);
    
END $$;
