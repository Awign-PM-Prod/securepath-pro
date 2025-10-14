-- =====================================================
-- Setup Password for Gig Worker by Email
-- Background Verification Platform
-- =====================================================

-- Function to setup password for gig worker by email
CREATE OR REPLACE FUNCTION setup_gig_worker_password(
    p_email TEXT,
    p_new_password TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    user_record RECORD;
    profile_record RECORD;
    gig_worker_record RECORD;
    token TEXT;
    result JSONB;
BEGIN
    -- Find the user by email
    SELECT u.id, u.email, u.email_confirmed_at
    INTO user_record
    FROM auth.users u
    WHERE u.email = p_email;
    
    IF user_record.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found with email: ' || p_email
        );
    END IF;
    
    -- Find the profile
    SELECT p.id, p.first_name, p.last_name, p.role
    INTO profile_record
    FROM profiles p
    WHERE p.user_id = user_record.id;
    
    IF profile_record.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Profile not found for user: ' || p_email
        );
    END IF;
    
    -- Check if it's a gig worker
    IF profile_record.role != 'gig_worker' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User is not a gig worker. Role: ' || profile_record.role
        );
    END IF;
    
    -- Find the gig worker record
    SELECT gp.id, gp.phone, gp.vendor_id
    INTO gig_worker_record
    FROM gig_partners gp
    WHERE gp.profile_id = profile_record.id;
    
    IF gig_worker_record.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Gig worker record not found for user: ' || p_email
        );
    END IF;
    
    -- If password is provided, update it directly
    IF p_new_password IS NOT NULL THEN
        -- Update the password in auth.users
        UPDATE auth.users 
        SET 
            encrypted_password = crypt(p_new_password, gen_salt('bf')),
            updated_at = now()
        WHERE id = user_record.id;
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Password updated successfully',
            'user_id', user_record.id,
            'email', p_email,
            'name', profile_record.first_name || ' ' || profile_record.last_name,
            'phone', gig_worker_record.phone,
            'vendor_id', gig_worker_record.vendor_id
        );
    ELSE
        -- Generate a password setup token
        token := encode(gen_random_bytes(32), 'hex');
        
        -- Insert or update the password setup token
        INSERT INTO password_setup_tokens (
            user_id,
            email,
            token,
            expires_at,
            created_by
        ) VALUES (
            user_record.id,
            p_email,
            token,
            now() + interval '24 hours',
            user_record.id  -- Self-created token
        )
        ON CONFLICT (user_id) DO UPDATE SET
            token = EXCLUDED.token,
            expires_at = EXCLUDED.expires_at,
            is_used = false,
            used_at = NULL;
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Password setup token generated',
            'user_id', user_record.id,
            'email', p_email,
            'name', profile_record.first_name || ' ' || profile_record.last_name,
            'phone', gig_worker_record.phone,
            'vendor_id', gig_worker_record.vendor_id,
            'setup_token', token,
            'setup_url', 'https://your-domain.com/setup-password?token=' || token
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Database error: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION setup_gig_worker_password(TEXT, TEXT) TO authenticated;

-- Example usage:
-- 1. Generate setup token (user will set their own password)
-- SELECT setup_gig_worker_password('gigworker@example.com');

-- 2. Set password directly
-- SELECT setup_gig_worker_password('gigworker@example.com', 'newpassword123');

-- 3. Check all gig workers and their status
SELECT 
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    gp.phone,
    gp.vendor_id,
    v.name as vendor_name,
    u.email_confirmed_at,
    CASE 
        WHEN u.encrypted_password IS NOT NULL THEN 'Password Set'
        ELSE 'No Password'
    END as password_status
FROM profiles p
JOIN gig_partners gp ON p.id = gp.profile_id
LEFT JOIN vendors v ON gp.vendor_id = v.id
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.role = 'gig_worker'
ORDER BY p.created_at DESC;
