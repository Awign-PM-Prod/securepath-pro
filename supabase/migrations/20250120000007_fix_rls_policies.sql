-- =====================================================
-- Fix RLS Policies for Rate Cards and Client Contracts
-- Background Verification Platform - Phase 1
-- =====================================================

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

