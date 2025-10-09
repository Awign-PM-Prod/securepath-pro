-- =====================================================
-- Test Rate Card Creation After RLS Fix
-- Run this after applying the RLS policies
-- =====================================================

-- Test creating a rate card (this should work for ops_team users)
INSERT INTO public.rate_cards (
  name,
  client_id,
  pincode_tier,
  completion_slab,
  base_rate_inr,
  default_travel_inr,
  default_bonus_inr,
  is_active,
  effective_from,
  created_by
) VALUES (
  'Test Rate Card',
  NULL,
  'tier_2',
  'within_48h',
  500.00,
  50.00,
  25.00,
  true,
  CURRENT_DATE,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Test creating a client contract (this should work for ops_team users)
INSERT INTO public.client_contracts (
  client_id,
  contract_number,
  contract_name,
  contract_type,
  start_date,
  end_date,
  default_tat_hours,
  rate_card_id,
  rate_override_policy,
  report_delivery_method,
  is_active,
  created_by
) VALUES (
  (SELECT id FROM public.clients LIMIT 1),
  'TEST-CONTRACT-001',
  'Test Contract',
  'MSA',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  24,
  (SELECT id FROM public.rate_cards WHERE name = 'Test Rate Card'),
  'standard',
  'email',
  true,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Verify the records were created
SELECT 'Rate Cards' as table_name, count(*) as record_count FROM public.rate_cards
UNION ALL
SELECT 'Client Contracts' as table_name, count(*) as record_count FROM public.client_contracts;

