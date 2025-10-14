-- =====================================================
-- Add Vendor Capacity Tracking
-- Background Verification Platform
-- =====================================================

-- Add capacity tracking fields to vendors table
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS max_daily_capacity INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS capacity_available INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS active_cases_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_capacity_reset TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Add index for capacity queries
CREATE INDEX IF NOT EXISTS idx_vendors_capacity_available ON public.vendors(capacity_available);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON public.vendors(is_active);

-- Update existing vendors with default capacity
UPDATE public.vendors 
SET 
  max_daily_capacity = 10,
  capacity_available = 10,
  active_cases_count = 0,
  last_capacity_reset = now()
WHERE max_daily_capacity IS NULL;

-- Create function to reset vendor capacity daily
CREATE OR REPLACE FUNCTION public.reset_vendor_capacity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset capacity for all active vendors
  UPDATE public.vendors 
  SET 
    capacity_available = max_daily_capacity,
    last_capacity_reset = now()
  WHERE is_active = true;
  
  -- Log the reset
  INSERT INTO public.audit_logs (
    table_name,
    operation,
    old_values,
    new_values,
    user_id,
    created_at
  ) VALUES (
    'vendors',
    'CAPACITY_RESET',
    '{}',
    jsonb_build_object('reset_at', now()),
    '00000000-0000-0000-0000-000000000000'::UUID,
    now()
  );
END;
$$;

-- Create function to consume vendor capacity
CREATE OR REPLACE FUNCTION public.consume_vendor_capacity(
  p_vendor_id UUID,
  p_cases_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_capacity INTEGER;
  new_capacity INTEGER;
BEGIN
  -- Get current capacity
  SELECT capacity_available INTO current_capacity
  FROM public.vendors
  WHERE id = p_vendor_id AND is_active = true;
  
  -- Check if enough capacity
  IF current_capacity IS NULL OR current_capacity < p_cases_count THEN
    RETURN false;
  END IF;
  
  -- Update capacity
  new_capacity := current_capacity - p_cases_count;
  
  UPDATE public.vendors
  SET 
    capacity_available = new_capacity,
    active_cases_count = active_cases_count + p_cases_count
  WHERE id = p_vendor_id;
  
  RETURN true;
END;
$$;

-- Create function to free vendor capacity
CREATE OR REPLACE FUNCTION public.free_vendor_capacity(
  p_vendor_id UUID,
  p_cases_count INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_capacity INTEGER;
  new_capacity INTEGER;
  max_capacity INTEGER;
BEGIN
  -- Get current capacity and max capacity
  SELECT capacity_available, max_daily_capacity INTO current_capacity, max_capacity
  FROM public.vendors
  WHERE id = p_vendor_id;
  
  -- Calculate new capacity (don't exceed max)
  new_capacity := LEAST(current_capacity + p_cases_count, max_capacity);
  
  -- Update capacity
  UPDATE public.vendors
  SET 
    capacity_available = new_capacity,
    active_cases_count = GREATEST(active_cases_count - p_cases_count, 0)
  WHERE id = p_vendor_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.reset_vendor_capacity TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_vendor_capacity TO authenticated;
GRANT EXECUTE ON FUNCTION public.free_vendor_capacity TO authenticated;

-- Show current vendor capacity status
SELECT 
  'Vendor Capacity Status' as section,
  id,
  name,
  max_daily_capacity,
  capacity_available,
  active_cases_count,
  ROUND((capacity_available::DECIMAL / max_daily_capacity * 100), 2) as capacity_percentage
FROM public.vendors
ORDER BY capacity_available DESC;
