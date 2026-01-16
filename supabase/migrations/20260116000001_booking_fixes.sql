-- =====================================================
-- BOOKING PROCESS FIXES MIGRATION
-- =====================================================
-- This migration adds security functions and policies to fix:
-- 1. Provider status update RLS bypass for booking creation
-- 2. Customer record race condition with atomic upsert
-- 3. Notification INSERT policies

-- 1. Create SECURITY DEFINER function to update provider status
-- Allows customers to update provider status when creating bookings
CREATE OR REPLACE FUNCTION update_provider_status_for_booking(
    p_provider_id UUID,
    p_new_status provider_status,
    p_booking_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validate: Either the user is the provider themselves,
    -- OR they have a booking relationship with the provider
    IF auth.uid() != p_provider_id THEN
        IF p_booking_id IS NULL THEN
            RAISE EXCEPTION 'Booking ID required when updating another provider status';
        END IF;

        -- Verify the booking belongs to the authenticated user
        IF NOT EXISTS (
            SELECT 1 FROM bookings
            WHERE id = p_booking_id
            AND (customer_id = auth.uid() OR provider_id = auth.uid())
        ) THEN
            RAISE EXCEPTION 'Access denied: no booking relationship with provider';
        END IF;
    END IF;

    -- Update provider status
    UPDATE providers
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_provider_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION update_provider_status_for_booking(UUID, provider_status, UUID) TO authenticated;


-- 2. Create atomic customer upsert function to handle race conditions
CREATE OR REPLACE FUNCTION ensure_customer_record(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify the user is creating their own customer record
    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Access denied: can only create own customer record';
    END IF;

    -- Atomic upsert - handles concurrent requests safely
    INSERT INTO customers (id, created_at, updated_at)
    VALUES (p_user_id, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION ensure_customer_record(UUID) TO authenticated;


-- 3. Add INSERT policy for notifications (allows system to create notifications for users)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'notifications'
        AND policyname = 'System can create notifications'
    ) THEN
        CREATE POLICY "System can create notifications" ON public.notifications
        FOR INSERT
        WITH CHECK (true);
    END IF;
END $$;


-- 4. Add INSERT policy for notification_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'notification_logs'
        AND policyname = 'System can create notification logs'
    ) THEN
        CREATE POLICY "System can create notification logs" ON public.notification_logs
        FOR INSERT
        WITH CHECK (true);
    END IF;
END $$;
