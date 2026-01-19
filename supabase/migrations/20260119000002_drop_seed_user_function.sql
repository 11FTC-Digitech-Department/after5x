-- Drop the create_seed_user helper function as it's not needed at runtime
-- and may cause schema query issues with Supabase Auth

DROP FUNCTION IF EXISTS public.create_seed_user(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_seed_user(UUID, TEXT, TEXT, TEXT);
