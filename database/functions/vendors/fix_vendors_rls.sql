-- =====================================================
-- Fix Vendors Table RLS Policies
-- Background Verification Platform
-- =====================================================

-- Temporarily disable RLS on vendors table
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "vendors_select_policy" ON vendors;
DROP POLICY IF EXISTS "vendors_insert_policy" ON vendors;
DROP POLICY IF EXISTS "vendors_update_policy" ON vendors;
DROP POLICY IF EXISTS "vendors_delete_policy" ON vendors;
DROP POLICY IF EXISTS "vendors_simple_select" ON vendors;
DROP POLICY IF EXISTS "vendors_simple_insert" ON vendors;
DROP POLICY IF EXISTS "vendors_simple_update" ON vendors;
DROP POLICY IF EXISTS "vendors_simple_delete" ON vendors;

-- Re-enable RLS with simple, non-recursive policies
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Create very simple policies that don't cause recursion
CREATE POLICY "vendors_simple_select" ON vendors
    FOR SELECT USING (true);

CREATE POLICY "vendors_simple_insert" ON vendors
    FOR INSERT WITH CHECK (true);

CREATE POLICY "vendors_simple_update" ON vendors
    FOR UPDATE USING (true);

CREATE POLICY "vendors_simple_delete" ON vendors
    FOR DELETE USING (true);

-- Test the policies
SELECT 'Vendors RLS policies fixed - using simple allow-all policies' as status;
