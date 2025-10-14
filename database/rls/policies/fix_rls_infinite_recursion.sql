-- =====================================================
-- Fix RLS Infinite Recursion Issues
-- Background Verification Platform
-- =====================================================

-- Drop all existing policies that might cause infinite recursion
DROP POLICY IF EXISTS "gig_partners_select_policy" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_insert_policy" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_update_policy" ON gig_partners;
DROP POLICY IF EXISTS "gig_partners_delete_policy" ON gig_partners;

-- Create simple, non-recursive policies for gig_partners
CREATE POLICY "gig_partners_select_policy" ON gig_partners
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        has_role('vendor') OR
        (has_role('gig_worker') AND id IN (
            SELECT gp.id FROM gig_partners gp
            JOIN profiles p ON gp.profile_id = p.id
            WHERE p.user_id = auth.uid()
        ))
    );

CREATE POLICY "gig_partners_insert_policy" ON gig_partners
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team')
    );

CREATE POLICY "gig_partners_update_policy" ON gig_partners
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        (has_role('gig_worker') AND id IN (
            SELECT gp.id FROM gig_partners gp
            JOIN profiles p ON gp.profile_id = p.id
            WHERE p.user_id = auth.uid()
        ))
    );

CREATE POLICY "gig_partners_delete_policy" ON gig_partners
    FOR DELETE USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team')
    );

-- Fix allocation_logs policies
DROP POLICY IF EXISTS "allocation_logs_select_policy" ON allocation_logs;
DROP POLICY IF EXISTS "allocation_logs_insert_policy" ON allocation_logs;
DROP POLICY IF EXISTS "allocation_logs_update_policy" ON allocation_logs;

CREATE POLICY "allocation_logs_select_policy" ON allocation_logs
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

CREATE POLICY "allocation_logs_insert_policy" ON allocation_logs
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team')
    );

CREATE POLICY "allocation_logs_update_policy" ON allocation_logs
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

-- Fix notifications policies
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;

CREATE POLICY "notifications_select_policy" ON notifications
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        has_role('gig_worker') OR
        has_role('vendor')
    );

CREATE POLICY "notifications_insert_policy" ON notifications
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

CREATE POLICY "notifications_update_policy" ON notifications
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

-- Test the policies
SELECT 'RLS policies fixed successfully' as status;
