-- =====================================================
-- Fix Form Templates Delete Permissions
-- =====================================================

-- Add DELETE policy for form_templates
CREATE POLICY "form_templates_delete" ON public.form_templates
    FOR DELETE USING (
        has_role('super_admin') OR
        has_role('ops_team')
    );

-- Grant DELETE permission to authenticated users
GRANT DELETE ON public.form_templates TO authenticated;

-- Also grant DELETE permission for form_fields (in case it's needed)
GRANT DELETE ON public.form_fields TO authenticated;
