-- Migration: Add location_url column to locations table
-- This migration adds the location_url column to store Google Maps or other location URLs

-- Add location_url column to locations table
ALTER TABLE public.locations 
ADD COLUMN location_url TEXT;

-- Add comment for the column
COMMENT ON COLUMN public.locations.location_url IS 'Google Maps or other location URL for easy navigation';

-- Add index for location_url queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_locations_location_url ON public.locations(location_url) WHERE location_url IS NOT NULL;
