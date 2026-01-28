-- Update handle_new_user function to set activated based on role
-- All roles: activated = true (except provider)
-- Provider: activated = false (requires review)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_phone TEXT;
  user_full_name TEXT;
  user_role TEXT;
  user_activated BOOLEAN;
BEGIN
  -- Validate required fields
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RAISE EXCEPTION 'Email is required for profile creation';
  END IF;

  -- Get phone number and convert empty strings to NULL
  user_phone := COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), NULLIF(NEW.phone, ''));

  -- Get full name (ensure it's not null)
  user_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'User'
  );

  -- Get role as text, default to customer and validate
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');

  -- Validate role is a valid enum value
  IF user_role NOT IN ('admin', 'customer', 'provider', 'agency_admin') THEN
    user_role := 'customer';
  END IF;

  -- Set activated based on role
  -- All roles are activated except provider (which requires review)
  IF user_role = 'provider' THEN
    user_activated := false;
  ELSE
    user_activated := true;
  END IF;

  -- Insert the profile with activated flag
  INSERT INTO public.profiles (id, email, full_name, role, phone_number, activated, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    user_role::public.app_role,
    user_phone,
    user_activated,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Handle race conditions

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but allow user creation to proceed
    -- This prevents auth failures due to profile creation issues
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;
