-- 1. ENUMS
CREATE TYPE booking_status AS ENUM ('finding_provider', 'pending_acceptance', 'confirmed', 'on_the_way', 'arrived', 'in_progress', 'payment_pending', 'paid', 'cancelled', 'rejected', 'expired');
CREATE TYPE booking_scheduling_type AS ENUM ('ASAP', 'SCHEDULED');
CREATE TYPE price_applied_tier AS ENUM ('STANDARD_DAY', 'AFTER5_NIGHT');

-- 2. BOOKINGS
CREATE TABLE public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) NOT NULL,
    provider_id UUID REFERENCES public.providers(id),
    booking_type booking_scheduling_type NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    address_snapshot JSONB NOT NULL, 
    service_location GEOGRAPHY(POINT, 4326) NOT NULL, 
    status booking_status DEFAULT 'finding_provider',
    otp_start VARCHAR(6),
    otp_end VARCHAR(6),
    cancellation_reason TEXT,
    cancelled_by UUID,
    provider_assigned_at TIMESTAMPTZ,
    started_travel_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    started_work_at TIMESTAMPTZ,
    finished_work_at TIMESTAMPTZ,
    total_labor_base DECIMAL(12,2) DEFAULT 0.00,
    total_transport_fees DECIMAL(12,2) DEFAULT 0.00,
    total_materials_amount DECIMAL(12,2) DEFAULT 0.00,
    total_vat_amount DECIMAL(12,2) DEFAULT 0.00,
    grand_total DECIMAL(12,2) DEFAULT 0.00,
    platform_fee DECIMAL(12,2) DEFAULT 0.00,
    provider_earnings DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BOOKING ITEMS
CREATE TABLE public.booking_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    service_variant_id UUID REFERENCES public.service_variants(id), 
    variant_name TEXT NOT NULL,
    price_tier_applied price_applied_tier NOT NULL DEFAULT 'STANDARD_DAY',
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    transportation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    vat_rate_snapshot DECIMAL(4,2) DEFAULT 0.12,
    vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    quantity INT DEFAULT 1,
    total_price DECIMAL(12,2) GENERATED ALWAYS AS ( ((base_price + vat_amount) + transportation_fee) * quantity ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BOOKING MATERIALS
CREATE TABLE public.booking_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    catalog_item_id UUID REFERENCES public.materials_catalog(id), 
    name TEXT NOT NULL, 
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT DEFAULT 1,
    total_price DECIMAL(12,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    is_customer_approved BOOLEAN DEFAULT FALSE, 
    added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer ON public.bookings(customer_id);
CREATE INDEX idx_bookings_provider ON public.bookings(provider_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_scheduled ON public.bookings(scheduled_for);

CREATE TRIGGER update_bookings_modtime BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();