-- Add discount display and story promotion columns to offers

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS discount_label TEXT,
  ADD COLUMN IF NOT EXISTS discount_condition TEXT,
  ADD COLUMN IF NOT EXISTS show_in_story BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS story_image_url TEXT;

-- Update existing PHP 100 offer with new fields
UPDATE public.offers
SET
  discount_label = '100 PHP OFF',
  discount_condition = 'ON YOUR FIRST BOOKING',
  show_in_story = true,
  story_image_url = 'assets/splash/main-splash.png'
WHERE voucher_code = 'AFTER5LAUNCH'
  AND status = 'active';
