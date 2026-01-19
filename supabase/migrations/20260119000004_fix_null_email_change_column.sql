-- ================================================================
-- FIX NULL EMAIL_CHANGE COLUMN
-- This migration fixes NULL email_change values that cause auth failures
-- Supabase Auth expects empty strings instead of NULL for string columns
-- ================================================================

-- Fix NULL email_change values for seeded users
UPDATE auth.users
SET
    email_change = COALESCE(email_change, ''),
    -- Also ensure other potentially problematic NULL string columns are fixed
    phone_change = COALESCE(phone_change, ''),
    updated_at = NOW()
WHERE
    email_change IS NULL
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

-- Fix any remaining NULL email_change values across all users to prevent future issues
UPDATE auth.users
SET
    email_change = COALESCE(email_change, ''),
    phone_change = COALESCE(phone_change, ''),
    updated_at = NOW()
WHERE email_change IS NULL OR phone_change IS NULL;

-- Log the changes for verification
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM auth.users
    WHERE email_change IS NOT NULL
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

    RAISE NOTICE 'Fixed email_change column for % seeded users', updated_count;
END $$;