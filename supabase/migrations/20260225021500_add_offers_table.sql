-- Customer home offers (date-window driven with manual status override)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_status') THEN
    CREATE TYPE offer_status AS ENUM ('draft', 'active', 'inactive', 'expired');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  badge_text TEXT,
  image_url TEXT,
  voucher_code TEXT,
  note TEXT,
  status offer_status NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  target_role TEXT NOT NULL DEFAULT 'customer', -- customer | provider | all
  sort_order INT NOT NULL DEFAULT 100,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT offers_target_role_check CHECK (target_role IN ('customer', 'provider', 'all')),
  CONSTRAINT offers_valid_window_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_offers_status_sort ON public.offers(status, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_window ON public.offers(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_offers_target_role ON public.offers(target_role);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view offers" ON public.offers;
CREATE POLICY "Authenticated users view offers"
ON public.offers
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage offers" ON public.offers;
CREATE POLICY "Admins manage offers"
ON public.offers
FOR ALL
USING (public.is_admin());

INSERT INTO public.offers (
  title,
  description,
  badge_text,
  image_url,
  voucher_code,
  note,
  status,
  starts_at,
  ends_at,
  target_role,
  sort_order
)
VALUES (
  'PHP 100 Off Your First Booking',
  'Welcome to After5. Use this voucher code at checkout to get PHP 100 off your first booking.',
  'Launch Offer',
  'assets/splash/main-splash.png',
  'AFTER5LAUNCH',
  'For new users only. Limited-time promo.',
  'active',
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '90 day',
  'customer',
  10
)
ON CONFLICT DO NOTHING;
