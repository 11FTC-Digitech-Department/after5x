-- ================================================================
-- FIX PROVIDER PROFILE ROLES
-- This migration fixes the roles for seeded provider accounts
-- that were incorrectly set to 'customer' instead of 'provider'
-- ================================================================

-- Fix the roles for tech accounts that have provider records
UPDATE public.profiles
SET
    role = 'provider'::public.app_role,
    updated_at = NOW()
WHERE id IN (
    SELECT p.id
    FROM public.profiles p
    INNER JOIN public.providers pr ON p.id = pr.id
    WHERE p.email LIKE '%tech@%ph'
);

-- Also fix agency admin roles
UPDATE public.profiles
SET
    role = 'agency_admin'::public.app_role,
    updated_at = NOW()
WHERE id IN (
    SELECT p.id
    FROM public.profiles p
    INNER JOIN public.agencies a ON p.id = a.owner_id
    WHERE p.email LIKE '%admin@%ph'
);

-- Log the changes
DO $$
DECLARE
    provider_count INTEGER;
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO provider_count
    FROM public.profiles
    WHERE role = 'provider' AND email LIKE '%tech@%ph';

    SELECT COUNT(*) INTO admin_count
    FROM public.profiles
    WHERE role = 'agency_admin' AND email LIKE '%admin@%ph';

    RAISE NOTICE 'Fixed % provider roles and % agency admin roles', provider_count, admin_count;
END $$;