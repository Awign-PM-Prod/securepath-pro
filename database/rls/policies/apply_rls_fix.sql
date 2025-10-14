-- =====================================================
-- Apply RLS Policies Fix for Rate Cards and Client Contracts
-- Copy and paste this into Supabase SQL Editor
-- =====================================================

-- First, let's check if the policies already exist and drop them if they do
DROP POLICY IF EXISTS "Ops team can manage rate cards" ON public.rate_cards;
DROP POLICY IF EXISTS "Public read access for rate cards" ON public.rate_cards;
DROP POLICY IF EXISTS "Ops team can manage client contracts" ON public.client_contracts;
DROP POLICY IF EXISTS "Clients can view their own contracts" ON public.client_contracts;

-- RLS policies for rate cards
CREATE POLICY "Ops team can manage rate cards"
  ON public.rate_cards FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin'));

CREATE POLICY "Public read access for rate cards"
  ON public.rate_cards FOR SELECT
  USING (is_active = true);

-- RLS policies for client contracts
CREATE POLICY "Ops team can manage client contracts"
  ON public.client_contracts FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin'));

CREATE POLICY "Clients can view their own contracts"
  ON public.client_contracts FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.created_by = auth.uid()
    ) OR
    public.has_role('ops_team') OR
    public.has_role('super_admin')
  );

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('rate_cards', 'client_contracts')
ORDER BY tablename, policyname;

