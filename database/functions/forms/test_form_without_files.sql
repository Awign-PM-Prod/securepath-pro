-- Test form submission without file uploads
-- This script creates a test form template that doesn't require file uploads

DO $$
DECLARE
    test_contract_type_id UUID;
    test_template_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get the UUID for 'business_address_check' from contract_type_config
    SELECT id INTO test_contract_type_id
    FROM public.contract_type_config
    WHERE type_key = 'business_address_check';

    -- Get an admin user ID
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = 'admin@example.com'
    LIMIT 1;

    -- Create a test form template without file uploads
    INSERT INTO public.form_templates (
        contract_type_id, 
        template_name, 
        template_version, 
        is_active, 
        created_by
    ) VALUES (
        test_contract_type_id,
        'Test Business Address Form (No Files)',
        2,
        true,
        admin_user_id
    ) RETURNING id INTO test_template_id;

    -- Insert simple form fields without file uploads
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config
    ) VALUES
    (test_template_id, 'entry_allowed', 'Was entry allowed into the premises?', 'multiple_choice', 'mandatory', 1,
     '{"options": ["Yes", "No"], "allow_multiple": false}'),
    
    (test_template_id, 'premises_type', 'Type of Premises', 'multiple_choice', 'mandatory', 2,
     '{"options": ["Office", "Warehouse", "Factory", "Retail Store", "Other"], "allow_multiple": false}'),
    
    (test_template_id, 'business_name_visible', 'Is the business name visible on the premises?', 'multiple_choice', 'mandatory', 3,
     '{"options": ["Yes", "No"], "allow_multiple": false}'),
    
    (test_template_id, 'contact_person_available', 'Was a contact person available?', 'multiple_choice', 'mandatory', 4,
     '{"options": ["Yes", "No"], "allow_multiple": false}'),
    
    (test_template_id, 'additional_notes', 'Additional Notes', 'paragraph', 'optional', 5,
     '{"placeholder": "Any additional observations or notes"}');

    RAISE NOTICE 'Test form template created with ID: %', test_template_id;
END
$$;
