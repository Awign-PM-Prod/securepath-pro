-- Fix RLS policies for case editing
-- This script ensures case editing works properly for ops_team users

-- First, check current RLS status
SELECT 'Current RLS status on cases table:' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'cases' 
AND schemaname = 'public';

-- Check current policies
SELECT 'Current RLS policies on cases table:' as info;
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual
FROM pg_policies 
WHERE tablename = 'cases' 
AND schemaname = 'public'
ORDER BY policyname;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Enable all for ops_team" ON public.cases;
DROP POLICY IF EXISTS "Enable all for super_admin" ON public.cases;
DROP POLICY IF EXISTS "Enable read and update for qc_team" ON public.cases;
DROP POLICY IF EXISTS "Enable update for qc_team" ON public.cases;
DROP POLICY IF EXISTS "Enable read for gig_workers" ON public.cases;
DROP POLICY IF EXISTS "Enable read for vendors" ON public.cases;
DROP POLICY IF EXISTS "Enable read for clients" ON public.cases;
DROP POLICY IF EXISTS "case_select_policy" ON public.cases;
DROP POLICY IF EXISTS "case_update_policy" ON public.cases;
DROP POLICY IF EXISTS "case_insert_policy" ON public.cases;
DROP POLICY IF EXISTS "case_delete_policy" ON public.cases;
DROP POLICY IF EXISTS "Enhanced case access policy" ON public.cases;
DROP POLICY IF EXISTS "Enhanced case modification policy" ON public.cases;

-- Create simple, working RLS policies
-- Allow ops_team and super_admin full access
CREATE POLICY "ops_team_full_access" ON public.cases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role IN ('ops_team', 'super_admin')
        )
    );

-- Allow qc_team to read and update cases
CREATE POLICY "qc_team_read_update" ON public.cases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'qc_team'
        )
    );

CREATE POLICY "qc_team_update" ON public.cases
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'qc_team'
        )
    );

-- Allow gig_workers to read their assigned cases
CREATE POLICY "gig_worker_read_assigned" ON public.cases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'gig_worker'
        )
        AND current_assignee_id IN (
            SELECT id FROM public.gig_partners 
            WHERE user_id = auth.uid()
        )
    );

-- Allow vendors to read their assigned cases
CREATE POLICY "vendor_read_assigned" ON public.cases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'vendor'
        )
        AND current_vendor_id IN (
            SELECT id FROM public.vendors 
            WHERE profile_id IN (
                SELECT id FROM public.profiles 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Verify the policies were created
SELECT 'New RLS policies created:' as info;
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual
FROM pg_policies 
WHERE tablename = 'cases' 
AND schemaname = 'public'
ORDER BY policyname;

-- Test if we can access cases (this should work for ops_team)
SELECT 'Testing case access after RLS fix...' as info;
SELECT COUNT(*) as accessible_cases FROM public.cases;
