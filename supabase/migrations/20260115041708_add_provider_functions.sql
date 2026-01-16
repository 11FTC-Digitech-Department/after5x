-- Function to increment provider booking count
CREATE OR REPLACE FUNCTION increment_provider_bookings(provider_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.providers
    SET
        total_bookings_processed = COALESCE(total_bookings_processed, 0) + 1,
        updated_at = NOW()
    WHERE id = provider_id;
END;
$$;

-- Function to update provider rating based on completed bookings
CREATE OR REPLACE FUNCTION update_provider_rating(provider_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    avg_rating DECIMAL(3,2);
    total_reviews INTEGER;
BEGIN
    -- Calculate average rating from completed bookings with ratings
    SELECT
        AVG(rating)::DECIMAL(3,2),
        COUNT(*)::INTEGER
    INTO avg_rating, total_reviews
    FROM booking_reviews br
    JOIN bookings b ON b.id = br.booking_id
    WHERE b.provider_id = provider_id
    AND b.status = 'completed';

    -- Update provider rating
    UPDATE public.providers
    SET
        rating = COALESCE(avg_rating, 0),
        total_reviews = total_reviews,
        updated_at = NOW()
    WHERE id = provider_id;
END;
$$;

-- Function to get available providers by service type and location
CREATE OR REPLACE FUNCTION get_available_providers(
    p_service_type TEXT,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_max_distance INTEGER DEFAULT 50000 -- 50km default
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
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id as provider_id,
        prof.full_name as provider_name,
        COALESCE(p.rating, 0) as provider_rating,
        (ST_Distance(
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            pl.location
        )::INTEGER) as distance_meters,
        GREATEST(5, (ST_Distance(
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            pl.location
        ) / 1000 / 30 * 60)::INTEGER) as estimated_arrival_minutes, -- Assume 30km/h average speed
        (p.current_status = 'available') as is_online
    FROM public.providers p
    JOIN public.profiles prof ON prof.id = p.owner_id
    JOIN public.provider_locations pl ON pl.provider_id = p.id
    JOIN public.provider_services ps ON ps.provider_id = p.id
    WHERE p.is_active = true
    AND p.current_status IN ('available', 'busy') -- Include busy providers as they might accept urgent bookings
    AND pl.is_active = true
    AND ps.is_active = true
    AND ps.service_type = p_service_type
    AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        pl.location,
        p_max_distance
    )
    ORDER BY
        (p.current_status = 'available') DESC, -- Online providers first
        distance_meters ASC, -- Closer providers first
        COALESCE(p.rating, 0) DESC; -- Higher rated providers first
END;
$$;