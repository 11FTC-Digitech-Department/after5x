-- ================================================================
-- FIX SEEDED USER PASSWORDS
-- This migration adds passwords to seeded auth.users that were
-- created without the encrypted_password field
-- ================================================================

-- Ensure pgcrypto extension is enabled (required for crypt function)
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Step 1: Update existing seeded users with a default development password
-- Target users that have NULL encrypted_password and are from seeded domains
-- Use extensions.crypt/gen_salt for Supabase hosted compatibility
-- Also fix NULL token columns that GoTrue requires to be empty strings
UPDATE auth.users
SET
    encrypted_password = extensions.crypt('Test123!', extensions.gen_salt('bf')),
    -- Fix NULL token columns - GoTrue requires empty strings, not NULL
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    updated_at = NOW()
WHERE encrypted_password IS NULL
  AND (
    email LIKE '%@teko.ph' OR
    email LIKE '%@rgl.ph' OR
    email LIKE '%@meier.ph' OR
    email LIKE '%@pame.ph' OR
    email LIKE '%@malabanan.ph' OR
    email LIKE '%@kmace.ph' OR
    email LIKE '%@newgen.ph' OR
    email LIKE '%@masterlock.ph'
  );

-- Step 2: Recreate the create_seed_user function with password support
-- Drop the old function first (it was dropped in the seed migration but recreate for safety)
DROP FUNCTION IF EXISTS public.create_seed_user(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_seed_user(UUID, TEXT, TEXT, TEXT);

-- Create updated helper function with password parameter
CREATE OR REPLACE FUNCTION public.create_seed_user(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT,
    user_password TEXT DEFAULT 'Test123!'
)
RETURNS void AS $$
BEGIN
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        role,
        aud
    )
    VALUES (
        user_id,
        '00000000-0000-0000-0000-000000000000',
        user_email,
        extensions.crypt(user_password, extensions.gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', user_full_name),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
    )
    ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Step 3: Clean up incorrect customer records for non-customer roles (optional)
-- Provider and agency_admin accounts should not have records in customers table
DELETE FROM public.customers
WHERE id IN (
    SELECT id FROM public.profiles
    WHERE role NOT IN ('customer')
);

-- Log the changes for verification
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM auth.users
    WHERE encrypted_password IS NOT NULL
      AND (
        email LIKE '%@teko.ph' OR
        email LIKE '%@rgl.ph' OR
        email LIKE '%@meier.ph' OR
        email LIKE '%@pame.ph' OR
        email LIKE '%@malabanan.ph' OR
        email LIKE '%@kmace.ph' OR
        email LIKE '%@newgen.ph' OR
        email LIKE '%@masterlock.ph'
      );

    RAISE NOTICE 'Updated % seeded users with passwords', updated_count;
END $$;
