-- 1. ADDRESSES
CREATE TABLE public.user_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL DEFAULT 'Home',
    is_default BOOLEAN DEFAULT FALSE,
    full_address TEXT NOT NULL,
    unit_details TEXT,
    access_instructions TEXT,
    has_parking BOOLEAN DEFAULT FALSE,
    parking_instructions TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_addresses_location ON public.user_addresses USING GIST (location);
CREATE INDEX idx_user_addresses_user_id ON public.user_addresses(user_id);

CREATE TRIGGER update_addresses_modtime BEFORE UPDATE ON public.user_addresses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();