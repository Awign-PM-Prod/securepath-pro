-- Create a configuration table for managing contract types dynamically
-- This allows adding new contract types without database migrations

-- Note: contract_type_config table will be created by migration 20250120000020
-- This migration only handles the data insertion and policies

-- Insert default contract types (only if table exists)
DO $$
BEGIN
    -- Check if table exists before inserting
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_type_config' AND table_schema = 'public') THEN
        INSERT INTO public.contract_type_config (
            type_key,
            display_name,
            description,
            is_active,
            sort_order
        ) VALUES 
            (
                'residential_address_check',
                'Residential Address Check',
                'Verification of residential addresses for individuals',
                true,
                1
            ),
            (
                'business_address_check',
                'Business Address Check',
                'Verification of business addresses for companies',
                true,
                2
            )
        ON CONFLICT (type_key) DO NOTHING;
        
        RAISE NOTICE 'Inserted default contract types';
    ELSE
        RAISE NOTICE 'contract_type_config table does not exist yet, skipping data insertion';
    END IF;
END $$;

-- Create RLS policies for contract_type_config (only if table exists)
DO $$
BEGIN
    -- Check if table exists before creating policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_type_config' AND table_schema = 'public') THEN
        -- Enable RLS
        ALTER TABLE public.contract_type_config ENABLE ROW LEVEL SECURITY;
        
        -- Policy for ops_team to manage contract types
        DROP POLICY IF EXISTS "ops_team can manage contract types" ON public.contract_type_config;
        CREATE POLICY "ops_team can manage contract types" ON public.contract_type_config
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE user_id = auth.uid() 
                    AND role = 'ops_team'
                )
            );

        -- Policy for clients to view contract types
        DROP POLICY IF EXISTS "clients can view contract types" ON public.contract_type_config;
        CREATE POLICY "clients can view contract types" ON public.contract_type_config
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE user_id = auth.uid() 
                    AND role = 'client'
                )
            );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_contract_type_config_active ON public.contract_type_config(is_active);
        CREATE INDEX IF NOT EXISTS idx_contract_type_config_sort_order ON public.contract_type_config(sort_order);
        
        RAISE NOTICE 'Created RLS policies and indexes for contract_type_config';
    ELSE
        RAISE NOTICE 'contract_type_config table does not exist yet, skipping policy creation';
    END IF;
END $$;

-- Verify the setup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_type_config' AND table_schema = 'public') THEN
        RAISE NOTICE 'Contract type configuration setup completed successfully';
        
        -- Show the data
        PERFORM * FROM public.contract_type_config ORDER BY sort_order;
    ELSE
        RAISE NOTICE 'contract_type_config table does not exist yet - will be created by migration 20';
    END IF;
END $$;
