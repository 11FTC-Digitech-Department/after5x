-- Ensure Provider Activated Safety Constraint
-- Adds CHECK constraint to prevent provider profiles from being created with activated = true
-- This is a safety layer in addition to the column default and trigger

-- Add CHECK constraint to ensure provider profiles cannot be created with activated = true
ALTER TABLE public.profiles
ADD CONSTRAINT check_provider_activated_false 
CHECK (
  (role = 'provider' AND activated = false) OR 
  (role != 'provider')
);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT check_provider_activated_false ON public.profiles IS 
'Ensures provider profiles are always created with activated=false. Providers must be activated by admin review.';
