-- Check current user permissions and role
-- Run this to diagnose RLS issues

-- Check current user
SELECT 
    'Current User Info:' as info,
    auth.uid() as user_id,
    auth.role() as auth_role;

-- Check user profile and role
SELECT 
    'User Profile:' as info,
    p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.role,
    p.is_active
FROM public.profiles p
WHERE p.user_id = auth.uid();

-- Check if user has ops_team role
SELECT 
    'Has ops_team role:' as info,
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role = 'ops_team'
    ) as has_ops_team_role;

-- Check if user has super_admin role
SELECT 
    'Has super_admin role:' as info,
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role = 'super_admin'
    ) as has_super_admin_role;

-- Check RLS status on cases table
SELECT 
    'RLS Status:' as info,
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE tablename = 'cases' 
AND schemaname = 'public';

-- Check existing RLS policies
SELECT 
    'Existing Policies:' as info,
    policyname,
    cmd,
    roles,
    permissive
FROM pg_policies 
WHERE tablename = 'cases' 
AND schemaname = 'public'
ORDER BY policyname;

-- Test if user can select from cases table
SELECT 
    'Can select from cases:' as info,
    COUNT(*) as case_count
FROM public.cases;

-- Test if user can insert into cases table (this might fail with RLS)
-- We'll just check the structure instead
SELECT 
    'Cases table structure:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND table_schema = 'public'
ORDER BY ordinal_position;
