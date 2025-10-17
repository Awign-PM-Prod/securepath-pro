-- Create Residence Verification Contract Type
-- Based on successful_residence_qc_approved_csv_dump fields

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
    'Residence Verification',
    'Comprehensive residence verification form with photo documentation and verification details',
    true,
    NOW(),
    NOW()
) ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = NOW()
RETURNING id;

-- Get the contract type ID
DO $$
DECLARE
    contract_type_id UUID;
BEGIN
    -- Get the contract type ID
    SELECT id INTO contract_type_id 
    FROM contract_types 
    WHERE name = 'Residence Verification';
    
    -- Create form sections and fields
    -- Section 1: Basic Information
    INSERT INTO form_sections (id, contract_type_id, title, description, order_index, is_active)
    VALUES (
        gen_random_uuid(),
        contract_type_id,
        'Basic Information',
        'Applicant and contact details',
        1,
        true
    );
    
    -- Section 2: Address Details
    INSERT INTO form_sections (id, contract_type_id, title, description, order_index, is_active)
    VALUES (
        gen_random_uuid(),
        contract_type_id,
        'Address Details',
        'Residential address and location information',
        2,
        true
    );
    
    -- Section 3: Verification Details
    INSERT INTO form_sections (id, contract_type_id, title, description, order_index, is_active)
    VALUES (
        gen_random_uuid(),
        contract_type_id,
        'Verification Details',
        'Visit and verification information',
        3,
        true
    );
    
    -- Section 4: Photo Documentation
    INSERT INTO form_sections (id, contract_type_id, title, description, order_index, is_active)
    VALUES (
        gen_random_uuid(),
        contract_type_id,
        'Photo Documentation',
        'Required photographs and evidence',
        4,
        true
    );
    
    -- Section 5: Field Executive Details
    INSERT INTO form_sections (id, contract_type_id, title, description, order_index, is_active)
    VALUES (
        gen_random_uuid(),
        contract_type_id,
        'Field Executive Details',
        'Field executive information and comments',
        5,
        true
    );
    
    -- Get section IDs for field creation
    DECLARE
        basic_info_section_id UUID;
        address_section_id UUID;
        verification_section_id UUID;
        photo_section_id UUID;
        field_exec_section_id UUID;
    BEGIN
        SELECT id INTO basic_info_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Basic Information';
        SELECT id INTO address_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Address Details';
        SELECT id INTO verification_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Verification Details';
        SELECT id INTO photo_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Photo Documentation';
        SELECT id INTO field_exec_section_id FROM form_sections WHERE contract_type_id = contract_type_id AND title = 'Field Executive Details';
        
        -- Basic Information Fields
        INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
        VALUES 
        (gen_random_uuid(), basic_info_section_id, 'lead_id', 'Lead ID', 'text', true, 1, '{"maxLength": 50}', null),
        (gen_random_uuid(), basic_info_section_id, 'applicant_name', 'Applicant Name', 'text', true, 2, '{"maxLength": 100}', null),
        (gen_random_uuid(), basic_info_section_id, 'co_applicant_name', 'Co-Applicant Name', 'text', false, 3, '{"maxLength": 100}', null),
        (gen_random_uuid(), basic_info_section_id, 'contact_no', 'Contact Number', 'phone', true, 4, '{"pattern": "^[0-9]{10}$"}', null),
        (gen_random_uuid(), basic_info_section_id, 'city', 'City', 'text', true, 5, '{"maxLength": 50}', null),
        (gen_random_uuid(), basic_info_section_id, 'fi_type', 'FI Type', 'select', true, 6, null, '[{"label": "Residence", "value": "residence"}, {"label": "Office", "value": "office"}, {"label": "Business", "value": "business"}]'),
        (gen_random_uuid(), basic_info_section_id, 'is_there_some_one_available_to_assist_you', 'Is someone available to assist?', 'radio', true, 7, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
        (gen_random_uuid(), basic_info_section_id, 'selfie_at_the_location', 'Selfie at Location', 'radio', true, 8, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]');
        
        -- Address Details Fields
        INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
        VALUES 
        (gen_random_uuid(), address_section_id, 'current_residential_address', 'Current Residential Address', 'textarea', true, 1, '{"maxLength": 500}', null),
        (gen_random_uuid(), address_section_id, 'address', 'Address', 'textarea', true, 2, '{"maxLength": 500}', null),
        (gen_random_uuid(), address_section_id, 'pin_code', 'PIN Code', 'text', true, 3, '{"pattern": "^[0-9]{6}$"}', null),
        (gen_random_uuid(), address_section_id, 'type_of_locality', 'Type of Locality', 'select', true, 4, null, '[{"label": "Urban", "value": "urban"}, {"label": "Semi-Urban", "value": "semi_urban"}, {"label": "Rural", "value": "rural"}]'),
        (gen_random_uuid(), address_section_id, 'ease_of_locating_the_address', 'Ease of Locating Address', 'select', true, 5, null, '[{"label": "Easy", "value": "easy"}, {"label": "Moderate", "value": "moderate"}, {"label": "Difficult", "value": "difficult"}]'),
        (gen_random_uuid(), address_section_id, 'nearby_landmark', 'Nearby Landmark', 'text', true, 6, '{"maxLength": 200}', null),
        (gen_random_uuid(), address_section_id, 'is_entry_allowed_in_the_premises', 'Is Entry Allowed in Premises', 'radio', true, 7, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]');
        
        -- Verification Details Fields
        INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
        VALUES 
        (gen_random_uuid(), verification_section_id, 'was_the_applicant_present_at_the_time_of_visit', 'Was Applicant Present at Time of Visit', 'radio', true, 1, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
        (gen_random_uuid(), verification_section_id, 'duration_of_stay', 'Duration of Stay', 'text', true, 2, '{"maxLength": 50}', null),
        (gen_random_uuid(), verification_section_id, 'gate_color', 'Gate Color', 'text', false, 3, '{"maxLength": 30}', null),
        (gen_random_uuid(), verification_section_id, 'color_of_building', 'Color of Building', 'text', false, 4, '{"maxLength": 30}', null),
        (gen_random_uuid(), verification_section_id, 'residence_status', 'Residence Status', 'select', true, 5, null, '[{"label": "Owned", "value": "owned"}, {"label": "Rented", "value": "rented"}, {"label": "Leased", "value": "leased"}, {"label": "Other", "value": "other"}]'),
        (gen_random_uuid(), verification_section_id, 'residence_type', 'Residence Type', 'select', true, 6, null, '[{"label": "Apartment", "value": "apartment"}, {"label": "Independent House", "value": "independent_house"}, {"label": "Villa", "value": "villa"}, {"label": "Other", "value": "other"}]'),
        (gen_random_uuid(), verification_section_id, 'verification_type', 'Verification Type', 'select', true, 7, null, '[{"label": "Physical Visit", "value": "physical_visit"}, {"label": "Video Call", "value": "video_call"}, {"label": "Document Verification", "value": "document_verification"}]'),
        (gen_random_uuid(), verification_section_id, 'mode_of_verification', 'Mode of Verification', 'select', true, 8, null, '[{"label": "In-Person", "value": "in_person"}, {"label": "Video", "value": "video"}, {"label": "Phone", "value": "phone"}]'),
        (gen_random_uuid(), verification_section_id, 'name_of_person_met', 'Name of Person Met', 'text', true, 9, '{"maxLength": 100}', null),
        (gen_random_uuid(), verification_section_id, 'relationship_with_applicant', 'Relationship with Applicant', 'select', true, 10, null, '[{"label": "Self", "value": "self"}, {"label": "Family Member", "value": "family_member"}, {"label": "Friend", "value": "friend"}, {"label": "Neighbor", "value": "neighbor"}, {"label": "Other", "value": "other"}]'),
        (gen_random_uuid(), verification_section_id, 'verifier_comments', 'Verifier Comments', 'textarea', false, 11, '{"maxLength": 1000}', null),
        (gen_random_uuid(), verification_section_id, 'if_details_are_mismatched_enter_correct_details', 'If Details Mismatched, Enter Correct Details', 'textarea', false, 12, '{"maxLength": 1000}', null);
        
        -- Photo Documentation Fields
        INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
        VALUES 
        (gen_random_uuid(), photo_section_id, 'is_the_door_photo_obtained', 'Is Door Photo Obtained', 'radio', true, 1, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
        (gen_random_uuid(), photo_section_id, 'is_internal_photograph_showing_the_reception_lobby_entrance_captured', 'Is Internal Photograph Captured', 'radio', true, 2, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
        (gen_random_uuid(), photo_section_id, 'is_board_name_photograph_captured', 'Is Board Name Photograph Captured', 'radio', true, 3, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
        (gen_random_uuid(), photo_section_id, 'is_building_photo_captured', 'Is Building Photo Captured', 'radio', true, 4, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
        (gen_random_uuid(), photo_section_id, 'main_door_photo', 'Main Door Photo', 'file', true, 5, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
        (gen_random_uuid(), photo_section_id, 'name_plate_photo', 'Name Plate Photo', 'file', false, 6, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
        (gen_random_uuid(), photo_section_id, 'internal_photograph', 'Internal Photograph', 'file', true, 7, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
        (gen_random_uuid(), photo_section_id, 'building_photo', 'Building Photo', 'file', true, 8, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
        (gen_random_uuid(), photo_section_id, 'landmark_image', 'Landmark Image', 'file', true, 9, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
        (gen_random_uuid(), photo_section_id, 'selfie_image', 'Selfie Image', 'file', false, 10, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null);
        
        -- Field Executive Details Fields
        INSERT INTO form_fields (id, section_id, field_name, field_label, field_type, is_required, order_index, validation_rules, options)
        VALUES 
        (gen_random_uuid(), field_exec_section_id, 'field_executive_met_with_other_than_family', 'Field Executive Met with Other than Family', 'radio', true, 1, null, '[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]'),
        (gen_random_uuid(), field_exec_section_id, 'field_executive_comments_if_met_someone', 'Field Executive Comments', 'textarea', false, 2, '{"maxLength": 1000}', null),
        (gen_random_uuid(), field_exec_section_id, 'field_executive_name', 'Field Executive Name', 'text', true, 3, '{"maxLength": 100}', null),
        (gen_random_uuid(), field_exec_section_id, 'date_and_time_of_visit', 'Date and Time of Visit', 'datetime', true, 4, null, null),
        (gen_random_uuid(), field_exec_section_id, 'signature_of_person_met', 'Signature of Person Met', 'file', false, 5, '{"fileTypes": ["image/jpeg", "image/png"], "maxSize": 10485760}', null),
        (gen_random_uuid(), field_exec_section_id, 'check_severity', 'Check Severity', 'select', true, 6, null, '[{"label": "Low", "value": "low"}, {"label": "Medium", "value": "medium"}, {"label": "High", "value": "high"}, {"label": "Critical", "value": "critical"}]'),
        (gen_random_uuid(), field_exec_section_id, 'final_disposition_if_report_is_positive', 'Final Disposition', 'select', true, 7, null, '[{"label": "Positive", "value": "positive"}, {"label": "Negative", "value": "negative"}, {"label": "Inconclusive", "value": "inconclusive"}]'),
        (gen_random_uuid(), field_exec_section_id, 'latitude_and_longitude', 'Latitude and Longitude', 'text', true, 8, '{"pattern": "^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?),\\s*[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$"}', null);
        
    END;
END $$;
