-- Add sort_order to services for admin catalog ordering
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
