-- 1. SERVICE CATEGORIES
CREATE TABLE public.service_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    icon_url TEXT,
    cancellation_fee DECIMAL(10,2) DEFAULT 250.00,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SERVICES
CREATE TABLE public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES public.service_categories(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    booking_form_schema JSONB DEFAULT '[]'::JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SERVICE VARIANTS
CREATE TABLE public.service_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- PRICING FORMULA
    price_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_max DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_after5_min DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_after5_max DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    vat_rate DECIMAL(4,2) DEFAULT 0.12,
    transportation_fee DECIMAL(10,2) DEFAULT 0.00,
    
    commission_rate DECIMAL(5,2) DEFAULT 20.00,
    duration_minutes INT DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT check_price_range CHECK (price_max >= price_min),
    CONSTRAINT check_after5_range CHECK (price_after5_max >= price_after5_min)
);

-- 4. PROVIDER OFFERINGS
CREATE TABLE public.provider_offerings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE NOT NULL,
    service_variant_id UUID REFERENCES public.service_variants(id) ON DELETE CASCADE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider_id, service_variant_id)
);

-- 5. MATERIALS
CREATE TABLE public.materials_catalog (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES public.service_categories(id),
    name TEXT NOT NULL,
    description TEXT,
    unit_price DECIMAL(10,2) DEFAULT 0.00,
    is_price_variable BOOLEAN DEFAULT FALSE,
    unit_measurement TEXT DEFAULT 'pcs',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_services_category ON public.services(category_id);
CREATE INDEX idx_variants_service ON public.service_variants(service_id);
CREATE INDEX idx_provider_offerings_lookup ON public.provider_offerings(provider_id, service_variant_id);

CREATE TRIGGER update_services_modtime BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_variants_modtime BEFORE UPDATE ON public.service_variants FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();