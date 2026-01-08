-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- Required for auth.users password hashing

-- 1. ENUMS for strict typing
CREATE TYPE app_role AS ENUM ('admin', 'customer', 'provider', 'agency_admin');
CREATE TYPE provider_status AS ENUM ('offline', 'online', 'busy', 'suspended');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');

-- 2. PROFILES (Base Identity)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone_number TEXT UNIQUE, 
    role app_role NOT NULL DEFAULT 'customer',
    fcm_token TEXT,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AGENCIES (Business Entities)
CREATE TABLE public.agencies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES public.profiles(id) NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    business_permit_no TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 0.00,
    verification_status verification_status DEFAULT 'pending',
    total_bookings_processed INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PROVIDERS (The workers)
CREATE TABLE public.providers (
    id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    agency_id UUID REFERENCES public.agencies(id),
    bio TEXT,
    years_of_experience INT DEFAULT 0,
    current_location GEOGRAPHY(POINT, 4326),
    service_radius_km INT DEFAULT 10,
    status provider_status DEFAULT 'offline',
    rating_avg DECIMAL(3,2) DEFAULT 0.00,
    rating_count INT DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 100.00,
    cancellation_rate DECIMAL(5,2) DEFAULT 0.00,
    verification_status verification_status DEFAULT 'pending',
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CUSTOMERS
CREATE TABLE public.customers (
    id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    xendit_customer_id TEXT,
    total_spend DECIMAL(12,2) DEFAULT 0.00,
    bookings_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. WALLETS
CREATE TABLE public.wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES public.profiles(id) NOT NULL,
    owner_type TEXT CHECK (owner_type IN ('provider', 'agency')),
    balance DECIMAL(12, 2) DEFAULT 0.00,
    frozen_balance DECIMAL(12, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'PHP',
    last_transaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, owner_type)
);

-- 7. PAYMENT METHODS
CREATE TABLE public.user_payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    payment_method_id TEXT NOT NULL,
    masked_card_number TEXT,
    card_brand TEXT,
    expiry_month INT,
    expiry_year INT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_providers_location ON public.providers USING GIST (current_location);
CREATE INDEX idx_providers_search ON public.providers USING GIN (search_vector);
CREATE INDEX idx_profiles_email ON public.profiles(email);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_agencies_modtime BEFORE UPDATE ON public.agencies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_providers_modtime BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_wallets_modtime BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- =========================================================
-- HELPER FUNCTIONS (Moved here so future migrations can use them)
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
BEGIN 
    RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_agency_owner_of_provider(target_provider_id UUID) RETURNS BOOLEAN AS $$
BEGIN 
    RETURN EXISTS (
        SELECT 1 FROM public.agencies a 
        JOIN public.providers p ON p.agency_id = a.id 
        WHERE a.owner_id = auth.uid() AND p.id = target_provider_id
    ); 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;