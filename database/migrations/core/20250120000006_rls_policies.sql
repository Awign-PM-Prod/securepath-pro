-- =====================================================
-- Row Level Security Policies Migration
-- Background Verification Platform - Phase 1
-- =====================================================

-- This migration adds only the missing RLS policies that are not covered in individual migrations
-- and ensures all tables have proper RLS enabled.

-- =====================================================
-- ADDITIONAL RLS POLICIES FOR CORE ENTITIES
-- =====================================================

-- RLS policies for clients table
CREATE POLICY "Authorized users can manage clients"
  ON public.clients FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin') OR public.has_role('vendor_team') OR public.has_role('qc_team'));

-- Additional policies for cases that weren't in core entities migration
CREATE POLICY "Gig workers can update their assigned cases"
  ON public.cases FOR UPDATE
  USING (
    current_assignee_id IN (
      SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
    ) AND
    status IN ('accepted', 'in_progress')
  );

-- Additional policies for case attachments
CREATE POLICY "Authorized users can manage case attachments"
  ON public.case_attachments FOR ALL
  USING (
    public.has_role('ops_team') OR
    public.has_role('super_admin') OR
    uploaded_by = auth.uid()
  );

-- =====================================================
-- ADDITIONAL RLS POLICIES FOR ALLOCATION & CAPACITY
-- =====================================================

-- Additional policies for allocation logs
CREATE POLICY "System can manage allocation logs"
  ON public.allocation_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role' OR public.has_role('ops_team') OR public.has_role('super_admin'));

-- Additional policies for capacity tracking
CREATE POLICY "System can manage capacity tracking"
  ON public.capacity_tracking FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role' OR public.has_role('ops_team') OR public.has_role('super_admin'));

-- Additional policies for performance metrics
CREATE POLICY "System can manage performance metrics"
  ON public.performance_metrics FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role' OR public.has_role('ops_team') OR public.has_role('super_admin'));

-- Additional policies for allocation config
CREATE POLICY "Ops team can manage allocation config"
  ON public.allocation_config FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin'));

-- =====================================================
-- ADDITIONAL RLS POLICIES FOR QUALITY CONTROL
-- =====================================================

-- Additional policies for gig workers to create submissions
CREATE POLICY "Gig workers can create submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (
    gig_partner_id IN (
      SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
    )
  );

-- Additional policies for gig workers to update their submissions
CREATE POLICY "Gig workers can update their submissions"
  ON public.submissions FOR UPDATE
  USING (
    gig_partner_id IN (
      SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
    ) AND
    status IN ('draft', 'submitted')
  );

-- Additional policies for submission photos
CREATE POLICY "Gig workers can manage their submission photos"
  ON public.submission_photos FOR ALL
  USING (
    submission_id IN (
      SELECT s.id FROM public.submissions s
      WHERE s.gig_partner_id IN (
        SELECT id FROM public.gig_partners WHERE user_id = auth.uid()
      )
    )
  );

-- Additional policies for QC reason codes
CREATE POLICY "Public read access for QC reason codes"
  ON public.qc_reason_codes FOR SELECT
  USING (is_active = true);

CREATE POLICY "QC team can manage reason codes"
  ON public.qc_reason_codes FOR ALL
  USING (public.has_role('qc_team') OR public.has_role('super_admin'));

-- Additional policies for QC quality standards
CREATE POLICY "Public read access for quality standards"
  ON public.qc_quality_standards FOR SELECT
  USING (is_active = true);

CREATE POLICY "QC team can manage quality standards"
  ON public.qc_quality_standards FOR ALL
  USING (public.has_role('qc_team') OR public.has_role('super_admin'));

-- =====================================================
-- ADDITIONAL RLS POLICIES FOR PAYMENT SYSTEM
-- =====================================================

-- Additional policies for payment adjustments
CREATE POLICY "Finance team can manage payment adjustments"
  ON public.payment_adjustments FOR ALL
  USING (public.has_role('super_admin') OR public.has_role('ops_team'));

-- Additional policies for payment config
CREATE POLICY "Finance team can manage payment config"
  ON public.payment_config FOR ALL
  USING (public.has_role('super_admin') OR public.has_role('ops_team'));

-- =====================================================
-- ADDITIONAL RLS POLICIES FOR COMMUNICATION SYSTEM
-- =====================================================

-- Additional policies for notification templates
CREATE POLICY "Public read access for notification templates"
  ON public.notification_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Ops team can manage notification templates"
  ON public.notification_templates FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin'));

-- Additional policies for audit logs (already defined in communication system migration)

-- Additional policies for rate cards
CREATE POLICY "Ops team can manage rate cards"
  ON public.rate_cards FOR ALL
  USING (public.has_role('ops_team') OR public.has_role('super_admin'));

CREATE POLICY "Public read access for rate cards"
  ON public.rate_cards FOR SELECT
  USING (is_active = true);

-- Additional policies for client contracts
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

-- =====================================================
-- ENHANCED SECURITY FUNCTIONS
-- =====================================================

-- Function to check if user can access case
CREATE OR REPLACE FUNCTION public.can_access_case(p_case_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  case_record RECORD;
  user_role app_role;
BEGIN
  -- Get current user role
  user_role := public.get_current_user_role();
  
  -- Super admin and ops team can access all cases
  IF user_role IN ('super_admin', 'ops_team') THEN
    RETURN true;
  END IF;
  
  -- Get case details
  SELECT c.*, gp.user_id as assignee_user_id, v.created_by as vendor_created_by, cl.created_by as client_created_by
  INTO case_record
  FROM public.cases c
  LEFT JOIN public.gig_partners gp ON c.current_assignee_id = gp.id
  LEFT JOIN public.vendors v ON c.current_vendor_id = v.id
  LEFT JOIN public.clients cl ON c.client_id = cl.id
  WHERE c.id = p_case_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check access based on role and case assignment
  CASE user_role
    WHEN 'gig_worker' THEN
      RETURN case_record.assignee_user_id = auth.uid();
    WHEN 'vendor' THEN
      RETURN case_record.vendor_created_by = auth.uid();
    WHEN 'client' THEN
      RETURN case_record.client_created_by = auth.uid();
    WHEN 'qc_team' THEN
      RETURN true; -- QC team can access all cases for review
    WHEN 'vendor_team' THEN
      RETURN case_record.vendor_created_by = auth.uid() OR case_record.assignee_user_id IS NOT NULL;
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can modify case
CREATE OR REPLACE FUNCTION public.can_modify_case(p_case_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role app_role;
BEGIN
  user_role := public.get_current_user_role();
  
  -- Only ops team and super admin can modify cases
  IF user_role IN ('super_admin', 'ops_team') THEN
    RETURN true;
  END IF;
  
  -- Gig workers can only update status of their assigned cases
  IF user_role = 'gig_worker' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.cases c
      JOIN public.gig_partners gp ON c.current_assignee_id = gp.id
      WHERE c.id = p_case_id 
        AND gp.user_id = auth.uid()
        AND c.status IN ('accepted', 'in_progress')
    );
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ENHANCED RLS POLICIES WITH FUNCTION CHECKS
-- =====================================================

-- Enhanced cases policies with function checks
CREATE POLICY "Enhanced case access policy"
  ON public.cases FOR SELECT
  USING (public.can_access_case(id));

CREATE POLICY "Enhanced case modification policy"
  ON public.cases FOR UPDATE
  USING (public.can_modify_case(id));

-- Enhanced case attachments policies
CREATE POLICY "Enhanced case attachments access policy"
  ON public.case_attachments FOR SELECT
  USING (public.can_access_case(case_id));

-- Enhanced submissions policies
CREATE POLICY "Enhanced submissions access policy"
  ON public.submissions FOR SELECT
  USING (public.can_access_case(case_id));

-- Enhanced QC reviews policies
CREATE POLICY "Enhanced QC reviews access policy"
  ON public.qc_reviews FOR SELECT
  USING (public.can_access_case(case_id));

-- =====================================================
-- GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant select on system tables for RLS functions
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.users TO service_role;

-- =====================================================
-- VERIFY RLS IS ENABLED
-- =====================================================

-- Ensure RLS is enabled on all tables
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'profiles', 'locations', 'clients', 'vendors', 'gig_partners', 'cases', 'case_attachments', 'rate_cards',
    'allocation_logs', 'capacity_tracking', 'performance_metrics', 'allocation_config',
    'submissions', 'submission_photos', 'qc_reviews', 'qc_workflow', 'qc_reason_codes', 'qc_quality_standards',
    'payment_cycles', 'payment_lines', 'payment_adjustments', 'vendor_payouts', 'payment_config', 'financial_reports',
    'email_intake_logs', 'notification_templates', 'notifications', 'communication_preferences', 'system_configs', 'audit_logs', 'client_contracts'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;