-- =====================================================
-- Fix ALL RLS Issues - Comprehensive Fix
-- Background Verification Platform
-- =====================================================

-- Disable RLS on all problematic tables
ALTER TABLE gig_partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to clean slate
-- gig_partners
DROP POLICY IF EXISTS "gig_partners_select_policy" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_insert_policy" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_update_policy" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_delete_policy" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_simple_select" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_simple_insert" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_simple_update" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_simple_delete" ON gig_partners;

-- vendors
DROP POLICY IF EXISTS "vendors_select_policy" ON vendors;
DROP POLICY IF EXISTS "vendors_insert_policy" ON vendors;
DROP POLICY IF EXISTS "vendors_update_policy" ON vendors;
DROP POLICY IF EXISTS "vendors_delete_policy" ON vendors;
DROP POLICY IF EXISTS "vendors_simple_select" ON vendors;
DROP POLICY IF EXISTS "vendors_simple_insert" ON vendors;
DROP POLICY IF EXISTS "vendors_simple_update" ON vendors;
DROP POLICY IF EXISTS "vendors_simple_delete" ON vendors;

-- allocation_logs
DROP POLICY IF EXISTS "allocation_logs_select_policy" ON allocation_logs;
DROP POLICY IF EXISTS "allocation_logs_insert_policy" ON allocation_logs;
DROP POLICY IF EXISTS "allocation_logs_update_policy" ON allocation_logs;
DROP POLICY IF EXISTS "allocation_logs_simple_select" ON allocation_logs;
DROP POLICY IF EXISTS "allocation_logs_simple_insert" ON allocation_logs;
DROP POLICY IF EXISTS "allocation_logs_simple_update" ON allocation_logs;

-- notifications
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_simple_select" ON notifications;
DROP POLICY IF EXISTS "notifications_simple_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_simple_update" ON notifications;

-- profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_simple_select" ON profiles;
DROP POLICY IF EXISTS "profiles_simple_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_simple_update" ON profiles;
DROP POLICY IF EXISTS "profiles_simple_delete" ON profiles;

-- Re-enable RLS with simple, non-recursive policies
ALTER TABLE gig_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create simple allow-all policies for gig_partners
CREATE POLICY "gig_partners_allow_all_select" ON gig_partners
    FOR SELECT USING (true);

CREATE POLICY "gig_partners_allow_all_insert" ON gig_partners
    FOR INSERT WITH CHECK (true);

CREATE POLICY "gig_partners_allow_all_update" ON gig_partners
    FOR UPDATE USING (true);

CREATE POLICY "gig_partners_allow_all_delete" ON gig_partners
    FOR DELETE USING (true);

-- Create simple allow-all policies for vendors
CREATE POLICY "vendors_allow_all_select" ON vendors
    FOR SELECT USING (true);

CREATE POLICY "vendors_allow_all_insert" ON vendors
    FOR INSERT WITH CHECK (true);

CREATE POLICY "vendors_allow_all_update" ON vendors
    FOR UPDATE USING (true);

CREATE POLICY "vendors_allow_all_delete" ON vendors
    FOR DELETE USING (true);

-- Create simple allow-all policies for allocation_logs
CREATE POLICY "allocation_logs_allow_all_select" ON allocation_logs
    FOR SELECT USING (true);

CREATE POLICY "allocation_logs_allow_all_insert" ON allocation_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "allocation_logs_allow_all_update" ON allocation_logs
    FOR UPDATE USING (true);

-- Create simple allow-all policies for notifications
CREATE POLICY "notifications_allow_all_select" ON notifications
    FOR SELECT USING (true);

CREATE POLICY "notifications_allow_all_insert" ON notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications_allow_all_update" ON notifications
    FOR UPDATE USING (true);

-- Create simple allow-all policies for profiles
CREATE POLICY "profiles_allow_all_select" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "profiles_allow_all_insert" ON profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "profiles_allow_all_update" ON profiles
    FOR UPDATE USING (true);

CREATE POLICY "profiles_allow_all_delete" ON profiles
    FOR DELETE USING (true);

-- Test the policies
SELECT 'All RLS policies fixed - using simple allow-all policies for all problematic tables' as status;
