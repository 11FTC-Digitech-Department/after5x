-- 1. TIME SLOTS
CREATE TABLE public.time_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.time_slots (name, start_time, end_time, sort_order) VALUES
('Morning', '06:00:00', '11:59:59', 1),
('Afternoon', '12:00:00', '17:59:59', 2),
('Evening', '18:00:00', '21:59:59', 3),
('Late Night', '22:00:00', '05:59:59', 4);

-- 2. SCHEDULES
CREATE TABLE public.provider_weekly_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider_id, day_of_week, start_time, end_time)
);

-- 3. EXCEPTIONS
CREATE TABLE public.provider_schedule_exceptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE NOT NULL,
    specific_date DATE NOT NULL,
    is_available BOOLEAN DEFAULT FALSE,
    start_time TIME, 
    end_time TIME,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AVAILABILITY VIEW
CREATE OR REPLACE VIEW public.view_provider_slot_availability WITH (security_invoker = true) AS
SELECT pws.provider_id, pws.day_of_week, ts.id as slot_id, ts.name as slot_name, ts.start_time as slot_start, ts.end_time as slot_end
FROM public.provider_weekly_schedules pws
CROSS JOIN public.time_slots ts
WHERE pws.is_active = true
AND (
    (pws.start_time <= ts.end_time AND pws.end_time >= ts.start_time) OR 
    (pws.end_time < pws.start_time AND ((pws.start_time <= ts.end_time) OR (pws.end_time >= ts.start_time)))
);

CREATE INDEX idx_schedules_provider_day ON public.provider_weekly_schedules(provider_id, day_of_week);
CREATE INDEX idx_exceptions_provider_date ON public.provider_schedule_exceptions(provider_id, specific_date);

ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view time slots" ON public.time_slots FOR SELECT USING (true);
CREATE POLICY "Admins manage time slots" ON public.time_slots FOR ALL USING (public.is_admin());

CREATE POLICY "Public view schedules" ON public.provider_weekly_schedules FOR SELECT USING (true);
CREATE POLICY "Providers/Agencies manage schedules" ON public.provider_weekly_schedules FOR ALL USING (auth.uid() = provider_id OR public.is_agency_owner_of_provider(provider_id) OR public.is_admin());

CREATE POLICY "Public view exceptions" ON public.provider_schedule_exceptions FOR SELECT USING (true);
CREATE POLICY "Providers/Agencies manage exceptions" ON public.provider_schedule_exceptions FOR ALL USING (auth.uid() = provider_id OR public.is_agency_owner_of_provider(provider_id) OR public.is_admin());