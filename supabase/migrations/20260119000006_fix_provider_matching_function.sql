-- Fix the get_available_providers function to use correct column reference
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
        COALESCE(p.rating_avg, 0) as provider_rating,
        (ST_Distance(
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            p.current_location
        )::INTEGER) as distance_meters,
        GREATEST(5, (ST_Distance(
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            p.current_location
        ) / 1000 / 30 * 60)::INTEGER) as estimated_arrival_minutes, -- Assume 30km/h average speed
        (p.status = 'online') as is_online
    FROM public.providers p
    JOIN public.profiles prof ON prof.id = p.id
    JOIN public.provider_offerings po ON po.provider_id = p.id
    JOIN public.service_variants sv ON sv.id = po.service_variant_id
    JOIN public.services s ON s.id = sv.service_id
    JOIN public.service_categories sc ON sc.id = s.category_id
    WHERE p.status IN ('online', 'busy') -- Include busy providers as they might accept urgent bookings
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
        (p.status = 'online') DESC, -- Online providers first
        distance_meters ASC, -- Closer providers first
        COALESCE(p.rating_avg, 0) DESC; -- Higher rated providers first
END;
$$;