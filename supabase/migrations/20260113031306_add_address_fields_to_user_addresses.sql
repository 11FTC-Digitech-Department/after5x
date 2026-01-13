-- Update user_addresses table to include all required fields for full address management
-- This migration adds the missing fields that should have been in the original schema

ALTER TABLE public.user_addresses
ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT 'Home',
ADD COLUMN IF NOT EXISTS full_address TEXT,
ADD COLUMN IF NOT EXISTS unit_details TEXT,
ADD COLUMN IF NOT EXISTS access_instructions TEXT,
ADD COLUMN IF NOT EXISTS has_parking BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parking_instructions TEXT;

-- Update existing records to have full_address based on location data if available
-- For now, we'll set a default full_address for existing records
UPDATE public.user_addresses
SET full_address = COALESCE(full_address, 'Address to be updated')
WHERE full_address IS NULL;

-- Make full_address NOT NULL after populating existing records
ALTER TABLE public.user_addresses
ALTER COLUMN full_address SET NOT NULL;

-- Update RLS policies to ensure users can access their own address data
-- (These should already exist from previous migration, but ensuring they're correct)
DROP POLICY IF EXISTS "Users see own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users manage own addresses" ON public.user_addresses;

CREATE POLICY "Users see own addresses" ON public.user_addresses
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own addresses" ON public.user_addresses
FOR ALL USING (auth.uid() = user_id);