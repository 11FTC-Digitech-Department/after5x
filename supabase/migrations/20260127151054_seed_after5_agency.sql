-- Seed After5 Verified Providers Agency
-- Creates the admin user and agency for provider applications
-- This is idempotent and safe to run multiple times

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Helper function to create auth user (same pattern as seed migration)
CREATE OR REPLACE FUNCTION public.create_after5_admin_user(user_id UUID, user_email TEXT, user_full_name TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud,
        confirmation_token, recovery_token, email_change_token_new,
        email_change_token_current, reauthentication_token, phone_change_token
    )
    VALUES (
        user_id,
        '00000000-0000-0000-0000-000000000000',
        user_email,
        extensions.crypt('Test123!', extensions.gen_salt('bf')),  -- Default dev password
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', user_full_name, 'role', 'agency_admin'),
        NOW(), NOW(),
        'authenticated', 'authenticated',
        '', '', '', '', '', ''  -- Empty strings for token fields
    )
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  agency_after5_id UUID := gen_random_uuid();
  agency_id UUID;
BEGIN
  -- Step 1: Create auth user for After5 admin
  PERFORM public.create_after5_admin_user(agency_after5_id, 'admin@after5verified.com', 'After5 Admin');
  
  -- Step 2: Create profile for After5 admin
  INSERT INTO public.profiles (id, email, full_name, phone_number, role, activated)
  VALUES (
    agency_after5_id,
    'admin@after5verified.com',
    'After5 Admin',
    '09170000000',
    'agency_admin',
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'agency_admin', activated = true, email = EXCLUDED.email;
  
  -- Step 3: Create After5 Verified Providers agency
  INSERT INTO public.agencies (id, name, owner_id, verification_status, commission_rate)
  VALUES (
    agency_after5_id,
    'After5 Verified Providers',
    agency_after5_id,
    'verified',
    15.00 -- 15% commission rate
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO agency_id;
  
  -- If agency already exists, get its ID
  IF agency_id IS NULL THEN
    SELECT id INTO agency_id
    FROM public.agencies
    WHERE name = 'After5 Verified Providers';
  END IF;
  
  RAISE NOTICE 'After5 Verified Providers agency created/found with ID: %', agency_id;
END $$;

-- Cleanup: Remove the helper function
DROP FUNCTION IF EXISTS public.create_after5_admin_user(UUID, TEXT, TEXT);

-- Add comment for documentation
COMMENT ON TABLE public.agencies IS 'Agencies manage providers. After5 Verified Providers is the default agency for new provider applications.';
