-- Fix RLS policies for vendors table
-- This script adds the missing RLS policies for the vendors table

-- Enable RLS on vendors table if not already enabled
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent errors on re-run
DROP POLICY IF EXISTS "Allow authenticated read access to vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow ops_team to manage vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow vendor_team to manage vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow super_admin to manage vendors" ON public.vendors;

-- Create policies for vendors table
-- Allow all authenticated users to read vendors (for dropdowns, etc.)
CREATE POLICY "Allow authenticated read access to vendors"
ON public.vendors FOR SELECT
USING (true);

-- Allow ops_team to manage (insert, update, delete) all vendors
CREATE POLICY "Allow ops_team to manage vendors"
ON public.vendors FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ops_team'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ops_team'));

-- Allow vendor_team to manage (insert, update, delete) all vendors
CREATE POLICY "Allow vendor_team to manage vendors"
ON public.vendors FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'vendor_team'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'vendor_team'));

-- Allow super_admin to manage (insert, update, delete) all vendors
CREATE POLICY "Allow super_admin to manage vendors"
ON public.vendors FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Verify the policies were created
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
WHERE schemaname = 'public' AND tablename = 'vendors'
ORDER BY policyname;
