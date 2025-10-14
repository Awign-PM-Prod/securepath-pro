-- =====================================================
-- Add Profile Link to Vendors Table
-- Background Verification Platform
-- =====================================================

-- Add profile_id column to vendors table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'vendors' 
        AND column_name = 'profile_id'
    ) THEN
        ALTER TABLE public.vendors 
        ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add index for better performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_vendors_profile_id ON public.vendors(profile_id);

-- Add unique constraint to ensure one profile per vendor (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'vendors' 
        AND constraint_name = 'vendors_profile_id_unique'
    ) THEN
        ALTER TABLE public.vendors 
        ADD CONSTRAINT vendors_profile_id_unique UNIQUE (profile_id);
    END IF;
END $$;

-- Update existing vendors to link them to their profiles
-- This will link vendors to profiles based on matching email addresses
UPDATE public.vendors 
SET profile_id = p.id
FROM public.profiles p
WHERE vendors.email = p.email 
  AND p.role = 'vendor'
  AND vendors.profile_id IS NULL;

-- Show the results
SELECT 
  'Vendor-Profile Links' as section,
  v.id as vendor_id,
  v.name as vendor_name,
  v.email as vendor_email,
  p.id as profile_id,
  p.first_name,
  p.last_name,
  p.role
FROM public.vendors v
LEFT JOIN public.profiles p ON v.profile_id = p.id
ORDER BY v.created_at;
