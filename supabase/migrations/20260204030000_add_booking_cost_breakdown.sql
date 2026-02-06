-- Add cost breakdown columns to bookings table for audit trail
-- These store individual cost components separately while showing only total to customers

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS base_service_fee DECIMAL(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS urgent_fee DECIMAL(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS body_camera_fee DECIMAL(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(4,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(12,2) DEFAULT 0.00;

COMMENT ON COLUMN public.bookings.base_service_fee IS 'Base service price (price_min or price_after5_min from variant) - stored separately for breakdown';
COMMENT ON COLUMN public.bookings.urgent_fee IS 'Urgent/emergency charge (only when urgency=emergency) - stored separately for breakdown';
COMMENT ON COLUMN public.bookings.body_camera_fee IS 'Body camera fee (only when user opts in) - stored separately for breakdown';
COMMENT ON COLUMN public.bookings.commission_rate IS 'Commission rate (%) applied at booking time (snapshot from variant commission_rate)';
COMMENT ON COLUMN public.bookings.commission_amount IS 'Commission amount calculated at booking time (for audit and reporting)';

-- Backfill existing bookings: split total_labor_base into components if possible
-- Note: For existing bookings, we can't perfectly split, so we'll set base_service_fee = total_labor_base
-- and leave urgent_fee/body_camera_fee as 0 for historical records
UPDATE public.bookings
SET
  base_service_fee = COALESCE(total_labor_base, 0.00),
  urgent_fee = 0.00,
  body_camera_fee = 0.00,
  commission_rate = 0.00,
  commission_amount = COALESCE(platform_fee, 0.00)
WHERE base_service_fee IS NULL OR base_service_fee = 0.00;
