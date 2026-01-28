-- Add Provider Application Fields
-- Adds activated flag to profiles, date_of_birth, and has_smartphone to providers

-- Add activated flag to profiles (default false - requires admin approval)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS activated BOOLEAN DEFAULT FALSE;

-- Add date_of_birth to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add smartphone ownership to providers (application requirement)
ALTER TABLE public.providers
ADD COLUMN IF NOT EXISTS has_smartphone BOOLEAN DEFAULT TRUE;

-- Add index for activated profiles (for admin queries)
CREATE INDEX IF NOT EXISTS idx_profiles_activated ON public.profiles(activated);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.activated IS 'Whether the provider account is activated and can start working. Defaults to false until admin approval.';
COMMENT ON COLUMN public.profiles.date_of_birth IS 'Date of birth for age verification and compliance.';
COMMENT ON COLUMN public.providers.has_smartphone IS 'Whether the provider owns a smartphone (application requirement).';
