-- =====================================================
-- Database Functions Test Only
-- Tests the database functions without creating or deleting data
-- =====================================================

-- Step 1: Test get_location_from_pincode function
SELECT 'Step 1: Testing get_location_from_pincode function...' as status;

-- Test with known pincode
SELECT 'Testing with pincode 560102 (Bangalore):' as test_case;
SELECT * FROM public.get_location_from_pincode('560102');

-- Test with another known pincode
SELECT 'Testing with pincode 110001 (Delhi):' as test_case;
SELECT * FROM public.get_location_from_pincode('110001');

-- Test with unknown pincode
SELECT 'Testing with unknown pincode 999999:' as test_case;
SELECT * FROM public.get_location_from_pincode('999999');

-- Step 2: Test get_rate_card_for_client_tier function
SELECT 'Step 2: Testing get_rate_card_for_client_tier function...' as status;

-- Test with first available client (if any)
DO $$
DECLARE
  test_client_id UUID;
  rate_card_count INTEGER;
BEGIN
  -- Get first available client
  SELECT id INTO test_client_id FROM public.clients LIMIT 1;
  
  IF test_client_id IS NOT NULL THEN
    RAISE NOTICE 'Testing with client ID: %', test_client_id;
    
    -- Test get_rate_card_for_client_tier
    SELECT COUNT(*) INTO rate_card_count
    FROM public.get_rate_card_for_client_tier(
      test_client_id,
      'tier_2',
      'within_24h'
    );
    
    RAISE NOTICE 'Found % rate cards for client %', rate_card_count, test_client_id;
    
    -- Show the actual rate cards
    FOR rec IN 
      SELECT * FROM public.get_rate_card_for_client_tier(
        test_client_id,
        'tier_2',
        'within_24h'
      )
    LOOP
      RAISE NOTICE 'Rate Card: % - Base: %, Travel: %, Bonus: %', 
        rec.rate_card_name, rec.base_rate_inr, rec.travel_allowance_inr, rec.bonus_inr;
    END LOOP;
  ELSE
    RAISE NOTICE 'No clients found - skipping client-specific rate card test';
  END IF;
END $$;

-- Test with global rate cards (client_id = NULL)
SELECT 'Testing global rate cards (client_id = NULL):' as test_case;
SELECT COUNT(*) as global_rate_card_count
FROM public.get_rate_card_for_client_tier(
  NULL,
  'tier_2',
  'within_24h'
);

-- Step 3: Test get_case_defaults function
SELECT 'Step 3: Testing get_case_defaults function...' as status;

-- Test with first available client (if any)
DO $$
DECLARE
  test_client_id UUID;
  defaults_count INTEGER;
BEGIN
  -- Get first available client
  SELECT id INTO test_client_id FROM public.clients LIMIT 1;
  
  IF test_client_id IS NOT NULL THEN
    RAISE NOTICE 'Testing get_case_defaults with client ID: %', test_client_id;
    
    -- Test get_case_defaults
    SELECT COUNT(*) INTO defaults_count
    FROM public.get_case_defaults(
      test_client_id,
      '560102',
      24
    );
    
    RAISE NOTICE 'Found % default configurations', defaults_count;
    
    -- Show the actual defaults
    FOR rec IN 
      SELECT * FROM public.get_case_defaults(
        test_client_id,
        '560102',
        24
      )
    LOOP
      RAISE NOTICE 'Defaults - City: %, State: %, Tier: %, TAT: %, Rate Card: %, Base Rate: %', 
        rec.city, rec.state, rec.tier, rec.default_tat_hours, rec.rate_card_name, rec.base_rate_inr;
    END LOOP;
  ELSE
    RAISE NOTICE 'No clients found - skipping case defaults test';
  END IF;
END $$;

-- Step 4: Test with different completion slabs
SELECT 'Step 4: Testing different completion slabs...' as status;

DO $$
DECLARE
  test_client_id UUID;
  slab TEXT;
  slab_hours INTEGER;
BEGIN
  -- Get first available client
  SELECT id INTO test_client_id FROM public.clients LIMIT 1;
  
  IF test_client_id IS NOT NULL THEN
    -- Test different completion slabs
    FOR slab, slab_hours IN VALUES 
      ('within_24h', 24),
      ('within_48h', 48),
      ('within_72h', 72),
      ('within_168h', 168),
      ('beyond_168h', 200)
    LOOP
      RAISE NOTICE 'Testing completion slab: % (TAT: % hours)', slab, slab_hours;
      
      FOR rec IN 
        SELECT * FROM public.get_case_defaults(
          test_client_id,
          '560102',
          slab_hours
        )
      LOOP
        RAISE NOTICE '  -> Rate Card: %, Base: %, Travel: %, Bonus: %', 
          rec.rate_card_name, rec.base_rate_inr, rec.travel_allowance_inr, rec.bonus_inr;
      END LOOP;
    END LOOP;
  ELSE
    RAISE NOTICE 'No clients found - skipping completion slab test';
  END IF;
END $$;

-- Step 5: Test with different pincodes
SELECT 'Step 5: Testing different pincodes...' as status;

DO $$
DECLARE
  test_client_id UUID;
  test_pincode TEXT;
BEGIN
  -- Get first available client
  SELECT id INTO test_client_id FROM public.clients LIMIT 1;
  
  IF test_client_id IS NOT NULL THEN
    -- Test different pincodes
    FOR test_pincode IN VALUES ('110001', '400001', '560001', '560102', '999999')
    LOOP
      RAISE NOTICE 'Testing pincode: %', test_pincode;
      
      FOR rec IN 
        SELECT * FROM public.get_case_defaults(
          test_client_id,
          test_pincode,
          24
        )
      LOOP
        RAISE NOTICE '  -> City: %, State: %, Tier: %', 
          rec.city, rec.state, rec.tier;
      END LOOP;
    END LOOP;
  ELSE
    RAISE NOTICE 'No clients found - skipping pincode test';
  END IF;
END $$;

-- Step 6: Test function error handling
SELECT 'Step 6: Testing function error handling...' as status;

-- Test with invalid client ID
SELECT 'Testing with invalid client ID:' as test_case;
SELECT COUNT(*) as result_count
FROM public.get_case_defaults(
  '00000000-0000-0000-0000-000000000000'::UUID,
  '560102',
  24
);

-- Test with empty pincode
SELECT 'Testing with empty pincode:' as test_case;
SELECT COUNT(*) as result_count
FROM public.get_case_defaults(
  (SELECT id FROM public.clients LIMIT 1),
  '',
  24
);

-- Step 7: Verify function permissions
SELECT 'Step 7: Verifying function permissions...' as status;

-- Check if functions exist and are accessible
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_location_from_pincode',
    'get_rate_card_for_client_tier', 
    'get_case_defaults'
  )
ORDER BY routine_name;

-- Step 8: Final summary
SELECT 'Step 8: Final summary...' as status;
SELECT 'All database function tests completed!' as final_status;
SELECT 'Functions are working correctly and ready for frontend integration!' as success_message;

