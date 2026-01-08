CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE media_context AS ENUM ('PROBLEM_REPORT', 'PROOF_OF_ARRIVAL', 'BEFORE_WORK', 'WORK_IN_PROGRESS', 'COMPLETED_WORK', 'RECEIPT_PROOF');

-- 1. BOOKING MEDIA
CREATE TABLE public.booking_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    uploader_id UUID REFERENCES public.profiles(id) NOT NULL,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    type media_type DEFAULT 'IMAGE',
    context media_context NOT NULL,
    description TEXT,
    captured_at_location GEOGRAPHY(POINT, 4326), 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TIMELINE
CREATE TABLE public.booking_timeline (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STORAGE BUCKET (If supported via SQL)
INSERT INTO storage.buckets (id, name, public) VALUES ('booking-attachments', 'booking-attachments', true) ON CONFLICT (id) DO NOTHING;

CREATE INDEX idx_booking_media_context ON public.booking_media(booking_id, context);
CREATE INDEX idx_timeline_booking ON public.booking_timeline(booking_id, created_at);

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'booking-attachments' );
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'booking-attachments' AND auth.role() = 'authenticated');