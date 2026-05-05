-- Account closure support.
-- Non-destructive: preserves marketplace history while anonymizing account identity data.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'closed')),
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_reason TEXT,
ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
ON public.profiles(account_status);

CREATE INDEX IF NOT EXISTS idx_profiles_closed_at
ON public.profiles(closed_at)
WHERE closed_at IS NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_id_fkey'
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_own_account(p_reason TEXT DEFAULT 'self_service')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profile profiles%ROWTYPE;
    v_active_bookings INTEGER := 0;
    v_pending_invoices INTEGER := 0;
    v_open_tickets INTEGER := 0;
    v_processing_payouts INTEGER := 0;
    v_is_provider_available BOOLEAN := FALSE;
    v_blockers JSONB := '[]'::JSONB;
    v_anonymized_email TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'not_authenticated',
            'message', 'You must be signed in to delete your account.'
        );
    END IF;

    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'profile_not_found',
            'message', 'Account profile was not found.'
        );
    END IF;

    IF v_profile.role = 'admin' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'admin_not_allowed',
            'message', 'Admin accounts cannot be deleted from the app.'
        );
    END IF;

    IF v_profile.closed_at IS NOT NULL OR v_profile.account_status = 'closed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'code', 'already_closed',
            'message', 'This account has already been deleted.'
        );
    END IF;

    IF v_profile.role = 'customer' THEN
        SELECT COUNT(*)
        INTO v_active_bookings
        FROM public.bookings
        WHERE customer_id = v_user_id
          AND status IN (
            'finding_provider',
            'pending_acceptance',
            'confirmed',
            'on_the_way',
            'arrived',
            'in_progress',
            'payment_pending'
          );

        SELECT COUNT(*)
        INTO v_pending_invoices
        FROM public.invoices
        WHERE customer_id = v_user_id
          AND status = 'PENDING';
    ELSIF v_profile.role = 'provider' THEN
        SELECT COUNT(*)
        INTO v_active_bookings
        FROM public.bookings
        WHERE provider_id = v_user_id
          AND status IN (
            'pending_acceptance',
            'confirmed',
            'on_the_way',
            'arrived',
            'in_progress',
            'payment_pending'
          );

        SELECT COUNT(*)
        INTO v_processing_payouts
        FROM public.payouts
        WHERE provider_id = v_user_id
          AND status = 'PROCESSING';

        SELECT EXISTS (
            SELECT 1
            FROM public.providers
            WHERE id = v_user_id
              AND status IN ('online', 'busy')
        )
        INTO v_is_provider_available;
    END IF;

    SELECT COUNT(*)
    INTO v_open_tickets
    FROM public.support_tickets
    WHERE requester_id = v_user_id
      AND status IN ('OPEN', 'IN_PROGRESS');

    IF v_active_bookings > 0 THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
            'code', 'active_bookings',
            'count', v_active_bookings,
            'message', 'Cancel or complete your active booking before deleting your account.'
        ));
    END IF;

    IF v_pending_invoices > 0 THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
            'code', 'pending_invoices',
            'count', v_pending_invoices,
            'message', 'Pay or resolve your pending payment before deleting your account.'
        ));
    END IF;

    IF v_processing_payouts > 0 THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
            'code', 'processing_payouts',
            'count', v_processing_payouts,
            'message', 'Wait for your processing payout to finish before deleting your account.'
        ));
    END IF;

    IF v_open_tickets > 0 THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
            'code', 'open_support_tickets',
            'count', v_open_tickets,
            'message', 'Close your open support ticket before deleting your account.'
        ));
    END IF;

    IF v_is_provider_available THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
            'code', 'provider_available',
            'count', 1,
            'message', 'Set your availability to offline before deleting your provider account.'
        ));
    END IF;

    IF jsonb_array_length(v_blockers) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'blocked',
            'message', 'Complete the required actions before deleting your account.',
            'blockers', v_blockers
        );
    END IF;

    v_anonymized_email := 'deleted+' || replace(v_user_id::TEXT, '-', '') || '@deleted.after5.local';

    DELETE FROM public.user_addresses WHERE user_id = v_user_id;
    DELETE FROM public.user_payment_methods WHERE user_id = v_user_id;
    DELETE FROM public.device_tokens WHERE user_id = v_user_id;
    DELETE FROM public.notification_preferences WHERE user_id = v_user_id;
    DELETE FROM public.notifications WHERE user_id = v_user_id;
    DELETE FROM public.announcement_reads WHERE user_id = v_user_id;

    UPDATE public.providers
    SET status = 'offline',
        current_location = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;

    UPDATE public.profiles
    SET account_status = 'closed',
        deletion_requested_at = COALESCE(deletion_requested_at, NOW()),
        closed_at = NOW(),
        closed_reason = COALESCE(NULLIF(trim(p_reason), ''), 'self_service'),
        anonymized_at = NOW(),
        email = v_anonymized_email,
        full_name = 'Deleted account',
        phone_number = NULL,
        avatar_url = NULL,
        fcm_token = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, changes)
    VALUES (
        v_user_id,
        'account.closed',
        'profile',
        v_user_id,
        jsonb_build_object(
            'method', 'self_service',
            'role', v_profile.role,
            'reason', COALESCE(NULLIF(trim(p_reason), ''), 'self_service')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'code', 'closed',
        'message', 'Your account has been deleted. You can create a new account in the future.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_own_account(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_available_providers(
    p_service_type TEXT,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_max_distance INTEGER DEFAULT 50000
)
RETURNS TABLE (
    provider_id UUID,
    provider_name TEXT,
    provider_rating DECIMAL(3,2),
    distance_meters INTEGER,
    estimated_arrival_minutes INTEGER,
    is_online BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id as provider_id,
        prof.full_name as provider_name,
        COALESCE(p.rating_avg, 0) as provider_rating,
        (ST_Distance(
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            p.current_location
        )::INTEGER) as distance_meters,
        GREATEST(5, (ST_Distance(
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            p.current_location
        ) / 1000 / 30 * 60)::INTEGER) as estimated_arrival_minutes,
        (p.status = 'online') as is_online
    FROM public.providers p
    JOIN public.profiles prof ON prof.id = p.id
    JOIN public.provider_offerings po ON po.provider_id = p.id
    JOIN public.service_variants sv ON sv.id = po.service_variant_id
    JOIN public.services s ON s.id = sv.service_id
    JOIN public.service_categories sc ON sc.id = s.category_id
    WHERE p.status IN ('online', 'busy')
    AND prof.account_status = 'active'
    AND prof.closed_at IS NULL
    AND po.is_active = true
    AND sv.is_active = true
    AND s.is_active = true
    AND sc.is_active = true
    AND sc.slug = p_service_type
    AND p.current_location IS NOT NULL
    AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p.current_location,
        p_max_distance
    )
    ORDER BY
        (p.status = 'online') DESC,
        distance_meters ASC,
        COALESCE(p.rating_avg, 0) DESC;
END;
$$;
