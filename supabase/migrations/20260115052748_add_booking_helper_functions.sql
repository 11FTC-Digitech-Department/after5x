-- SECURITY DEFINER function to create booking items (bypasses RLS)
CREATE OR REPLACE FUNCTION create_booking_item(
    p_booking_id UUID,
    p_service_variant_id UUID,
    p_variant_name TEXT,
    p_price_tier TEXT,
    p_base_price DECIMAL,
    p_transportation_fee DECIMAL,
    p_vat_rate DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item_id UUID;
BEGIN
    -- Verify the booking belongs to the authenticated user
    IF NOT EXISTS (
        SELECT 1 FROM bookings
        WHERE id = p_booking_id
        AND customer_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied: booking does not belong to user';
    END IF;

    -- Insert the booking item
    INSERT INTO booking_items (
        booking_id,
        service_variant_id,
        variant_name,
        price_tier_applied,
        base_price,
        transportation_fee,
        vat_rate_snapshot
    ) VALUES (
        p_booking_id,
        p_service_variant_id,
        p_variant_name,
        p_price_tier::price_applied_tier,
        p_base_price,
        p_transportation_fee,
        p_vat_rate
    )
    RETURNING id INTO v_item_id;

    RETURN v_item_id;
END;
$$;

-- SECURITY DEFINER function to create timeline entries (bypasses RLS)
CREATE OR REPLACE FUNCTION create_booking_timeline_entry(
    p_booking_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_icon_name TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entry_id UUID;
BEGIN
    -- Verify the user has access to this booking
    IF NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.id = p_booking_id
        AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid() OR public.is_admin())
    ) THEN
        RAISE EXCEPTION 'Access denied: user does not have permission for this booking';
    END IF;

    -- Insert the timeline entry
    INSERT INTO booking_timeline (
        booking_id,
        title,
        description,
        icon_name
    ) VALUES (
        p_booking_id,
        p_title,
        p_description,
        p_icon_name
    )
    RETURNING id INTO v_entry_id;

    RETURN v_entry_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_booking_item(UUID, UUID, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION create_booking_timeline_entry(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;