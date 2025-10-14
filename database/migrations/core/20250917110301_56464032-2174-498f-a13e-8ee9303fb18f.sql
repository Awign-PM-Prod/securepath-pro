-- Create a test super admin user directly in profiles table
-- First generate a UUID for the user
DO $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Generate a new UUID
    new_user_id := gen_random_uuid();
    
    -- Insert into profiles table with generated UUID
    INSERT INTO public.profiles (
        user_id, 
        email, 
        first_name, 
        last_name, 
        role,
        is_active
    ) VALUES (
        new_user_id,
        'admin@bgverification.com',
        'System',
        'Administrator', 
        'super_admin',
        true
    );
    
    -- Output the generated UUID for reference
    RAISE NOTICE 'Created profile with user_id: %', new_user_id;
END $$;