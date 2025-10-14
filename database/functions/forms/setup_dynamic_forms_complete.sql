-- Complete setup for dynamic forms system
-- This script will set up everything needed for the dynamic forms to work

-- 1. First, ensure contract_type_config has the right structure
DO $$
BEGIN
    -- Add missing columns if they don't exist
    ALTER TABLE public.contract_type_config
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

    ALTER TABLE public.contract_type_config
    ADD COLUMN IF NOT EXISTS display_name TEXT;

    ALTER TABLE public.contract_type_config
    ADD COLUMN IF NOT EXISTS description TEXT;

    ALTER TABLE public.contract_type_config
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

    ALTER TABLE public.contract_type_config
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

    ALTER TABLE public.contract_type_config
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

    ALTER TABLE public.contract_type_config
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

    -- Update existing rows to set display_name if it's NULL
    UPDATE public.contract_type_config
    SET
        display_name = COALESCE(display_name, type_key),
        description = COALESCE(description, 'Default description for ' || type_key),
        is_active = COALESCE(is_active, TRUE),
        sort_order = COALESCE(sort_order, 0),
        created_at = COALESCE(created_at, now()),
        updated_at = COALESCE(updated_at, now())
    WHERE display_name IS NULL OR description IS NULL OR is_active IS NULL OR sort_order IS NULL OR created_at IS NULL OR updated_at IS NULL;

    -- Make display_name NOT NULL
    ALTER TABLE public.contract_type_config
    ALTER COLUMN display_name SET NOT NULL;

    -- Add primary key constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_type_config_pkey') THEN
        ALTER TABLE public.contract_type_config
        ADD CONSTRAINT contract_type_config_pkey PRIMARY KEY (id);
    END IF;

    -- Add unique constraint on type_key if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_type_config_type_key_unique') THEN
        ALTER TABLE public.contract_type_config
        ADD CONSTRAINT contract_type_config_type_key_unique UNIQUE (type_key);
    END IF;
END
$$;

-- 2. Insert or update contract types
INSERT INTO public.contract_type_config (type_key, display_name, description, is_active, sort_order)
VALUES
    ('residential_address_check', 'Residential Address Check', 'Verification of residential addresses for individuals', TRUE, 1),
    ('business_address_check', 'Business Address Check', 'Verification of business addresses for companies', TRUE, 2)
ON CONFLICT (type_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- 3. Get the business_address_check contract type ID
DO $$
DECLARE
    business_contract_type_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get the UUID for 'business_address_check'
    SELECT id INTO business_contract_type_id
    FROM public.contract_type_config
    WHERE type_key = 'business_address_check';

    -- Get an admin user ID (use the first available user)
    SELECT id INTO admin_user_id
    FROM auth.users
    LIMIT 1;

    -- If no admin user exists, create a temporary one
    IF admin_user_id IS NULL THEN
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES (gen_random_uuid(), 'admin@example.com', 'temp_password', now(), now(), now())
        RETURNING id INTO admin_user_id;
    END IF;

    -- Create or update the form template
    INSERT INTO public.form_templates (contract_type_id, template_name, template_version, is_active, created_by)
    VALUES (business_contract_type_id, 'Business Address Verification Form', 1, TRUE, admin_user_id)
    ON CONFLICT (contract_type_id, template_version) DO UPDATE SET
        template_name = EXCLUDED.template_name,
        is_active = EXCLUDED.is_active,
        updated_at = now();

    -- Get the template ID
    SELECT id INTO business_contract_type_id
    FROM public.form_templates
    WHERE contract_type_id = (SELECT id FROM public.contract_type_config WHERE type_key = 'business_address_check')
    AND template_version = 1;

    -- Insert form fields (without dependencies first)
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    ) VALUES
    (business_contract_type_id, 'entry_allowed', 'Was entry allowed into the premises?', 'multiple_choice', 'mandatory', 1, 
     '{"options": ["Yes", "No"], "allow_multiple": false}', NULL, NULL, NULL, NULL, NULL),
    
    (business_contract_type_id, 'premises_type', 'Type of Premises', 'multiple_choice', 'mandatory', 2,
     '{"options": ["Office", "Warehouse", "Factory", "Retail Store", "Other"], "allow_multiple": false}', NULL, NULL, NULL, NULL, NULL),
    
    (business_contract_type_id, 'business_name_visible', 'Is the business name visible on the premises?', 'multiple_choice', 'mandatory', 4,
     '{"options": ["Yes", "No"], "allow_multiple": false}', NULL, NULL, NULL, NULL, NULL),
    
    (business_contract_type_id, 'contact_person_available', 'Was a contact person available?', 'multiple_choice', 'mandatory', 6,
     '{"options": ["Yes", "No"], "allow_multiple": false}', NULL, NULL, NULL, NULL, NULL),
    
    (business_contract_type_id, 'selfie_with_customer', 'Selfie Image with Customer', 'file_upload', 'mandatory', 9,
     '{"description": "Take a selfie with the customer/contact person"}', NULL, NULL, 1, '{"image/jpeg", "image/png"}', 5),
    
    (business_contract_type_id, 'inside_office_pics', 'Inside Pics of Office', 'file_upload', 'mandatory', 10,
     '{"description": "Take 3 pictures inside the office"}', NULL, NULL, 3, '{"image/jpeg", "image/png"}', 5),
    
    (business_contract_type_id, 'stock_photo', 'Stock Photo', 'file_upload', 'mandatory', 11,
     '{"description": "Take 5 stock photos of the premises"}', NULL, NULL, 5, '{"image/jpeg", "image/png"}', 5),
    
    (business_contract_type_id, 'additional_notes', 'Additional Notes', 'paragraph', 'optional', 12,
     '{"placeholder": "Any additional observations or notes"}', NULL, NULL, NULL, NULL, NULL)
    ON CONFLICT (template_id, field_key) DO UPDATE SET
        field_title = EXCLUDED.field_title,
        field_type = EXCLUDED.field_type,
        validation_type = EXCLUDED.validation_type,
        field_order = EXCLUDED.field_order,
        field_config = EXCLUDED.field_config,
        depends_on_field_id = EXCLUDED.depends_on_field_id,
        depends_on_value = EXCLUDED.depends_on_value,
        max_files = EXCLUDED.max_files,
        allowed_file_types = EXCLUDED.allowed_file_types,
        max_file_size_mb = EXCLUDED.max_file_size_mb,
        updated_at = now();

    -- Now update fields with dependencies
    -- Update premises_other to depend on premises_type
    UPDATE public.form_fields 
    SET depends_on_field_id = (
        SELECT id FROM public.form_fields 
        WHERE template_id = business_contract_type_id AND field_key = 'premises_type'
    ),
    depends_on_value = 'Other',
    field_order = 3
    WHERE template_id = business_contract_type_id AND field_key = 'premises_other';

    -- Insert premises_other if it doesn't exist
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    )
    SELECT 
        business_contract_type_id,
        'premises_other',
        'If Other, please specify',
        'short_answer',
        'optional',
        3,
        '{"placeholder": "Please specify the type of premises"}',
        (SELECT id FROM public.form_fields WHERE template_id = business_contract_type_id AND field_key = 'premises_type'),
        'Other',
        NULL, NULL, NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM public.form_fields 
        WHERE template_id = business_contract_type_id AND field_key = 'premises_other'
    );

    -- Update business_name to depend on business_name_visible
    UPDATE public.form_fields 
    SET depends_on_field_id = (
        SELECT id FROM public.form_fields 
        WHERE template_id = business_contract_type_id AND field_key = 'business_name_visible'
    ),
    depends_on_value = 'Yes',
    field_order = 5
    WHERE template_id = business_contract_type_id AND field_key = 'business_name';

    -- Insert business_name if it doesn't exist
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    )
    SELECT 
        business_contract_type_id,
        'business_name',
        'Business Name (if visible)',
        'short_answer',
        'optional',
        5,
        '{"placeholder": "Enter the business name as displayed"}',
        (SELECT id FROM public.form_fields WHERE template_id = business_contract_type_id AND field_key = 'business_name_visible'),
        'Yes',
        NULL, NULL, NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM public.form_fields 
        WHERE template_id = business_contract_type_id AND field_key = 'business_name'
    );

    -- Update contact_person_name to depend on contact_person_available
    UPDATE public.form_fields 
    SET depends_on_field_id = (
        SELECT id FROM public.form_fields 
        WHERE template_id = business_contract_type_id AND field_key = 'contact_person_available'
    ),
    depends_on_value = 'Yes',
    field_order = 7
    WHERE template_id = business_contract_type_id AND field_key = 'contact_person_name';

    -- Insert contact_person_name if it doesn't exist
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    )
    SELECT 
        business_contract_type_id,
        'contact_person_name',
        'Contact Person Name',
        'short_answer',
        'optional',
        7,
        '{"placeholder": "Enter the contact person name"}',
        (SELECT id FROM public.form_fields WHERE template_id = business_contract_type_id AND field_key = 'contact_person_available'),
        'Yes',
        NULL, NULL, NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM public.form_fields 
        WHERE template_id = business_contract_type_id AND field_key = 'contact_person_name'
    );

    -- Update contact_person_designation to depend on contact_person_available
    UPDATE public.form_fields 
    SET depends_on_field_id = (
        SELECT id FROM public.form_fields 
        WHERE template_id = business_contract_type_id AND field_key = 'contact_person_available'
    ),
    depends_on_value = 'Yes',
    field_order = 8
    WHERE template_id = business_contract_type_id AND field_key = 'contact_person_designation';

    -- Insert contact_person_designation if it doesn't exist
    INSERT INTO public.form_fields (
        template_id, field_key, field_title, field_type, validation_type, field_order, field_config,
        depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
    )
    SELECT 
        business_contract_type_id,
        'contact_person_designation',
        'Contact Person Designation',
        'short_answer',
        'optional',
        8,
        '{"placeholder": "Enter the designation"}',
        (SELECT id FROM public.form_fields WHERE template_id = business_contract_type_id AND field_key = 'contact_person_available'),
        'Yes',
        NULL, NULL, NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM public.form_fields 
        WHERE template_id = business_contract_type_id AND field_key = 'contact_person_designation'
    );

    RAISE NOTICE 'Form template and fields created/updated successfully';
END
$$;

-- 4. Enable RLS on contract_type_config if not already enabled
ALTER TABLE public.contract_type_config ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for contract_type_config
DROP POLICY IF EXISTS "Allow all authenticated users to read contract types" ON public.contract_type_config;
DROP POLICY IF EXISTS "Allow ops_team to manage contract types" ON public.contract_type_config;

CREATE POLICY "Allow all authenticated users to read contract types"
ON public.contract_type_config FOR SELECT
USING (true);

CREATE POLICY "Allow ops_team to manage contract types"
ON public.contract_type_config FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ops_team'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ops_team'));

-- 6. Verify the setup
SELECT 
    'Setup Complete' as status,
    (SELECT COUNT(*) FROM public.contract_type_config) as contract_types,
    (SELECT COUNT(*) FROM public.form_templates) as form_templates,
    (SELECT COUNT(*) FROM public.form_fields) as form_fields;
