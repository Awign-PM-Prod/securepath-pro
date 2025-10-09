-- Fix RLS policies for cases table
-- This script ensures proper RLS policies are in place for case creation

-- First, let's check current RLS policies on cases table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'cases' 
AND schemaname = 'public'
ORDER BY policyname;

-- Check if RLS is enabled on cases table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'cases' 
AND schemaname = 'public';

-- Drop existing policies if they exist (to recreate them properly)
DROP POLICY IF EXISTS "Enable insert for ops_team" ON public.cases;
DROP POLICY IF EXISTS "Enable read for ops_team" ON public.cases;
DROP POLICY IF EXISTS "Enable update for ops_team" ON public.cases;
DROP POLICY IF EXISTS "Enable delete for ops_team" ON public.cases;
DROP POLICY IF EXISTS "Enable insert for super_admin" ON public.cases;
DROP POLICY IF EXISTS "Enable read for super_admin" ON public.cases;
DROP POLICY IF EXISTS "Enable update for super_admin" ON public.cases;
DROP POLICY IF EXISTS "Enable delete for super_admin" ON public.cases;

-- Create comprehensive RLS policies for cases table
-- Policy for ops_team to manage cases
CREATE POLICY "Enable all for ops_team" ON public.cases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'ops_team'
        )
    );

-- Policy for super_admin to manage cases
CREATE POLICY "Enable all for super_admin" ON public.cases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- Policy for qc_team to read and update cases (but not create/delete)
CREATE POLICY "Enable read and update for qc_team" ON public.cases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'qc_team'
        )
    );

CREATE POLICY "Enable update for qc_team" ON public.cases
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'qc_team'
        )
    );

-- Policy for gig_workers to read their assigned cases
CREATE POLICY "Enable read for gig_workers" ON public.cases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'gig_worker'
        )
        AND (
            current_assignee_id = (
                SELECT id FROM public.gig_partners 
                WHERE user_id = auth.uid()
            )
            OR current_assignee_type = 'gig'
        )
    );

-- Policy for vendors to read their assigned cases
CREATE POLICY "Enable read for vendors" ON public.cases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'vendor'
        )
        AND (
            current_vendor_id = (
                SELECT id FROM public.vendors 
                WHERE created_by = auth.uid()
            )
            OR current_assignee_type = 'vendor'
        )
    );

-- Policy for clients to read their own cases
CREATE POLICY "Enable read for clients" ON public.cases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'client'
        )
        AND client_id = (
            SELECT id FROM public.clients 
            WHERE created_by = auth.uid()
        )
    );

-- Verify the policies were created
SELECT 
    'RLS Policies created successfully' as status,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'cases' 
AND schemaname = 'public';

-- Show all policies
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'cases' 
AND schemaname = 'public'
ORDER BY policyname;
