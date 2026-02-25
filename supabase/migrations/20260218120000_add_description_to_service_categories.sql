-- Add optional description to service_categories for admin catalog
ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS description TEXT;
