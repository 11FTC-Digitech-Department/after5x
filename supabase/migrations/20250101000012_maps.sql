-- 1. PLANS
CREATE TABLE public.booking_route_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    encoded_polyline TEXT NOT NULL,
    estimated_duration_seconds INT,
    estimated_distance_meters INT,
    origin_point GEOGRAPHY(POINT, 4326),
    destination_point GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LOGS
CREATE TABLE public.booking_gps_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    provider_id UUID REFERENCES public.providers(id) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    heading DECIMAL(5,2),
    speed_kmh DECIMAL(5,2),
    battery_level DECIMAL(5,2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gps_logs_booking_time ON public.booking_gps_logs(booking_id, recorded_at);

ALTER TABLE public.booking_route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_gps_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view route plans" ON public.booking_route_plans FOR SELECT USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_route_plans.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid())) OR public.is_admin());
CREATE POLICY "Participants view gps logs" ON public.booking_gps_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_gps_logs.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid())) OR public.is_admin());
CREATE POLICY "Providers log gps" ON public.booking_gps_logs FOR INSERT WITH CHECK (auth.uid() = provider_id);