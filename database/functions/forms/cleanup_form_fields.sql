-- Clean up duplicate form fields and keep only the business address verification fields we want
-- This script will remove all existing form fields and recreate only the ones we need

DO $$
DECLARE
    business_template_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get the business address verification form template ID
    SELECT id INTO business_template_id
    FROM public.form_templates
    WHERE template_name = 'Business Address Verification Form'
    AND contract_type_id = (SELECT id FROM public.contract_type_config WHERE type_key = 'business_address_check')
    LIMIT 1;

    -- Get an admin user ID
    SELECT id INTO admin_user_id
    FROM auth.users
    LIMIT 1;

    -- Delete all existing form fields for this template
    DELETE FROM public.form_fields WHERE template_id = business_template_id;

    -- Insert only the fields we want for business address verification
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    ) VALUES
    (business_template_id, 'entry_allowed', 'Was entry allowed into the premises?', 'multiple_choice', 'mandatory', 1, 
     '{"options": ["Yes", "No"], "allow_multiple": false}', NULL, NULL, NULL, NULL, NULL),
    
    (business_template_id, 'premises_type', 'Type of Premises', 'multiple_choice', 'mandatory', 2,
     '{"options": ["Office", "Warehouse", "Factory", "Retail Store", "Other"], "allow_multiple": false}', NULL, NULL, NULL, NULL, NULL),
    
    (business_template_id, 'business_name_visible', 'Is the business name visible on the premises?', 'multiple_choice', 'mandatory', 4,
     '{"options": ["Yes", "No"], "allow_multiple": false}', NULL, NULL, NULL, NULL, NULL),
    
    (business_template_id, 'contact_person_available', 'Was a contact person available?', 'multiple_choice', 'mandatory', 6,
     '{"options": ["Yes", "No"], "allow_multiple": false}', NULL, NULL, NULL, NULL, NULL),
    
    (business_template_id, 'selfie_with_customer', 'Selfie Image with Customer', 'file_upload', 'mandatory', 9,
     '{"description": "Take a selfie with the customer/contact person"}', NULL, NULL, 1, '{"image/jpeg", "image/png"}', 5),
    
    (business_template_id, 'inside_office_pics', 'Inside Pics of Office', 'file_upload', 'mandatory', 10,
     '{"description": "Take 3 pictures inside the office"}', NULL, NULL, 3, '{"image/jpeg", "image/png"}', 5),
    
    (business_template_id, 'stock_photo', 'Stock Photo', 'file_upload', 'mandatory', 11,
     '{"description": "Take 5 stock photos of the premises"}', NULL, NULL, 5, '{"image/jpeg", "image/png"}', 5),
    
    (business_template_id, 'additional_notes', 'Additional Notes', 'paragraph', 'optional', 12,
     '{"placeholder": "Any additional observations or notes"}', NULL, NULL, NULL, NULL, NULL);

    -- Now add the conditional fields
    -- premises_other depends on premises_type
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    )
    SELECT 
        business_template_id,
        'premises_other',
        'If Other, please specify',
        'short_answer',
        'optional',
        3,
        '{"placeholder": "Please specify the type of premises"}',
        (SELECT id FROM public.form_fields WHERE template_id = business_template_id AND field_key = 'premises_type'),
        'Other',
        NULL, NULL, NULL;

    -- business_name depends on business_name_visible
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    )
    SELECT 
        business_template_id,
        'business_name',
        'Business Name (if visible)',
        'short_answer',
        'optional',
        5,
        '{"placeholder": "Enter the business name as displayed"}',
        (SELECT id FROM public.form_fields WHERE template_id = business_template_id AND field_key = 'business_name_visible'),
        'Yes',
        NULL, NULL, NULL;

    -- contact_person_name depends on contact_person_available
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    )
    SELECT 
        business_template_id,
        'contact_person_name',
        'Contact Person Name',
        'short_answer',
        'optional',
        7,
        '{"placeholder": "Enter the contact person name"}',
        (SELECT id FROM public.form_fields WHERE template_id = business_template_id AND field_key = 'contact_person_available'),
        'Yes',
        NULL, NULL, NULL;

    -- contact_person_designation depends on contact_person_available
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    )
    SELECT 
        business_template_id,
        'contact_person_designation',
        'Contact Person Designation',
        'short_answer',
        'optional',
        8,
        '{"placeholder": "Enter the designation"}',
        (SELECT id FROM public.form_fields WHERE template_id = business_template_id AND field_key = 'contact_person_available'),
        'Yes',
        NULL, NULL, NULL;

    RAISE NOTICE 'Cleaned up form fields. Now have % fields for business address verification.', 
        (SELECT COUNT(*) FROM public.form_fields WHERE template_id = business_template_id);
END
$$;
