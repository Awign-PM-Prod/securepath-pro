-- Migration: Create contract_type_config table for dynamic contract type management
-- This migration creates the contract_type_config table that was referenced in previous migrations

-- Create contract_type_config table
CREATE TABLE IF NOT EXISTS public.contract_type_config (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    type_key text NOT NULL UNIQUE,
    display_name text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT contract_type_config_pkey PRIMARY KEY (id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_contract_type_config_type_key ON public.contract_type_config(type_key);
CREATE INDEX IF NOT EXISTS idx_contract_type_config_is_active ON public.contract_type_config(is_active);
CREATE INDEX IF NOT EXISTS idx_contract_type_config_sort_order ON public.contract_type_config(sort_order);

-- Add comments
COMMENT ON TABLE public.contract_type_config IS 'Configuration table for contract types, allowing dynamic management';
COMMENT ON COLUMN public.contract_type_config.type_key IS 'Unique key for the contract type (e.g., residential_address_check)';
COMMENT ON COLUMN public.contract_type_config.display_name IS 'Human-readable display name for the contract type';
COMMENT ON COLUMN public.contract_type_config.description IS 'Description of what this contract type covers';
COMMENT ON COLUMN public.contract_type_config.is_active IS 'Whether this contract type is currently active';
COMMENT ON COLUMN public.contract_type_config.sort_order IS 'Order for displaying contract types in UI';

-- Enable RLS
ALTER TABLE public.contract_type_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (only if they don't exist)
DO $$
BEGIN
    -- Policy for ops_team to manage contract types
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Allow ops_team to manage contract types' 
        AND tablename = 'contract_type_config'
        AND schemaname = 'public'
    ) THEN
        CREATE POLICY "Allow ops_team to manage contract types" ON public.contract_type_config
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE profiles.user_id = auth.uid() 
                    AND profiles.role = 'ops_team'
                )
            );
        RAISE NOTICE 'Created policy: Allow ops_team to manage contract types';
    ELSE
        RAISE NOTICE 'Policy already exists: Allow ops_team to manage contract types';
    END IF;

    -- Policy for super_admin to manage contract types
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Allow super_admin to manage contract types' 
        AND tablename = 'contract_type_config'
        AND schemaname = 'public'
    ) THEN
        CREATE POLICY "Allow super_admin to manage contract types" ON public.contract_type_config
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE profiles.user_id = auth.uid() 
                    AND profiles.role = 'super_admin'
                )
            );
        RAISE NOTICE 'Created policy: Allow super_admin to manage contract types';
    ELSE
        RAISE NOTICE 'Policy already exists: Allow super_admin to manage contract types';
    END IF;
END $$;

-- Insert default contract types (only if they don't exist)
DO $$
DECLARE
    insert_count integer := 0;
BEGIN
    -- Insert residential_address_check if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM public.contract_type_config WHERE type_key = 'residential_address_check') THEN
        INSERT INTO public.contract_type_config (type_key, display_name, description, is_active, sort_order) 
        VALUES ('residential_address_check', 'Residential Address Check', 'Verification of residential addresses for individuals', true, 1);
        insert_count := insert_count + 1;
    END IF;
    
    -- Insert business_address_check if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM public.contract_type_config WHERE type_key = 'business_address_check') THEN
        INSERT INTO public.contract_type_config (type_key, display_name, description, is_active, sort_order) 
        VALUES ('business_address_check', 'Business Address Check', 'Verification of business addresses for companies', true, 2);
        insert_count := insert_count + 1;
    END IF;
    
    IF insert_count > 0 THEN
        RAISE NOTICE 'Inserted % default contract types', insert_count;
    ELSE
        RAISE NOTICE 'Default contract types already exist, skipping insertion';
    END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_contract_type_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_contract_type_config_updated_at ON public.contract_type_config;
CREATE TRIGGER trigger_update_contract_type_config_updated_at
    BEFORE UPDATE ON public.contract_type_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_contract_type_config_updated_at();
