-- =====================================================
-- Fix Contract Type Config RLS Policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "contract_type_config_select_policy" ON public.contract_type_config;
DROP POLICY IF EXISTS "contract_type_config_insert_policy" ON public.contract_type_config;
DROP POLICY IF EXISTS "contract_type_config_update_policy" ON public.contract_type_config;
DROP POLICY IF EXISTS "contract_type_config_delete_policy" ON public.contract_type_config;

-- Create new RLS policies for contract_type_config
CREATE POLICY "contract_type_config_select_policy" ON public.contract_type_config
FOR SELECT USING (true);

CREATE POLICY "contract_type_config_insert_policy" ON public.contract_type_config
FOR INSERT WITH CHECK (true);

CREATE POLICY "contract_type_config_update_policy" ON public.contract_type_config
FOR UPDATE USING (true);

CREATE POLICY "contract_type_config_delete_policy" ON public.contract_type_config
FOR DELETE USING (true);

-- Grant necessary permissions
GRANT SELECT ON public.contract_type_config TO authenticated;
GRANT SELECT ON public.contract_type_config TO anon;

-- Verify the data is accessible
SELECT id, type_key, display_name FROM public.contract_type_config WHERE type_key = 'business_address_check';
