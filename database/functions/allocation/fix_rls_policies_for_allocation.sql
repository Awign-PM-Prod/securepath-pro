-- =====================================================
-- Fix RLS Policies for Allocation
-- Background Verification Platform
-- =====================================================

-- Fix client_contracts RLS policy
DROP POLICY IF EXISTS "client_contracts_select_policy" ON client_contracts;
CREATE POLICY "client_contracts_select_policy" ON client_contracts
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team')
    );

-- Fix locations RLS policy
DROP POLICY IF EXISTS "locations_select_policy" ON locations;
CREATE POLICY "locations_select_policy" ON locations
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        has_role('gig_worker') OR
        has_role('vendor')
    );

-- Fix pincode_tiers RLS policy
DROP POLICY IF EXISTS "pincode_tiers_select_policy" ON pincode_tiers;
CREATE POLICY "pincode_tiers_select_policy" ON pincode_tiers
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        has_role('gig_worker') OR
        has_role('vendor')
    );

-- Fix gig_partners RLS policy for allocation
DROP POLICY IF EXISTS "gig_partners_select_policy" ON gig_partners;
CREATE POLICY "gig_partners_select_policy" ON gig_partners
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        has_role('vendor') OR
        (has_role('gig_worker') AND id IN (
            SELECT id FROM gig_partners WHERE profile_id IN (
                SELECT id FROM profiles WHERE user_id = auth.uid()
            )
        ))
    );

-- Fix vendors RLS policy for allocation
DROP POLICY IF EXISTS "vendors_select_policy" ON vendors;
CREATE POLICY "vendors_select_policy" ON vendors
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        (has_role('vendor') AND id IN (
            SELECT id FROM vendors WHERE profile_id IN (
                SELECT id FROM profiles WHERE user_id = auth.uid()
            )
        ))
    );

-- Fix cases RLS policy for updates
DROP POLICY IF EXISTS "cases_update_policy" ON cases;
CREATE POLICY "cases_update_policy" ON cases
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team') OR
        has_role('qc_team') OR
        (has_role('gig_worker') AND current_assignee_id IN (
            SELECT id FROM gig_partners WHERE profile_id IN (
                SELECT id FROM profiles WHERE user_id = auth.uid()
            )
        )) OR
        (has_role('vendor') AND current_vendor_id IN (
            SELECT id FROM vendors WHERE profile_id IN (
                SELECT id FROM profiles WHERE user_id = auth.uid()
            )
        ))
    );

-- Fix allocation_logs RLS policy
DROP POLICY IF EXISTS "allocation_logs_insert_policy" ON allocation_logs;
CREATE POLICY "allocation_logs_insert_policy" ON allocation_logs
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team')
    );

-- Fix capacity_tracking RLS policy
DROP POLICY IF EXISTS "capacity_tracking_insert_policy" ON capacity_tracking;
CREATE POLICY "capacity_tracking_insert_policy" ON capacity_tracking
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team')
    );

DROP POLICY IF EXISTS "capacity_tracking_update_policy" ON capacity_tracking;
CREATE POLICY "capacity_tracking_update_policy" ON capacity_tracking
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        has_role('ops_team') OR 
        has_role('super_admin') OR
        has_role('vendor_team')
    );

-- Test the policies
SELECT 'RLS policies updated successfully' as status;
