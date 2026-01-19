-- Fix user creation triggers to be more robust and handle errors gracefully

-- Update the handle_new_user function to be more defensive
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_phone TEXT;
  user_full_name TEXT;
  user_role TEXT;
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

  -- Insert the profile with conflict handling
  INSERT INTO public.profiles (id, email, full_name, role, phone_number, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    user_role::public.app_role,
    user_phone,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Handle race conditions

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise to prevent user creation if profile creation fails
    RAISE EXCEPTION 'Failed to create profile for user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Update the customer creation function to handle errors gracefully
CREATE OR REPLACE FUNCTION create_customer_on_profile_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create customer record if role is 'customer'
    IF NEW.role = 'customer' THEN
        INSERT INTO public.customers (id, created_at, updated_at)
        VALUES (NEW.id, NEW.created_at, NEW.updated_at)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the profile creation
        RAISE WARNING 'Failed to create customer record for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;