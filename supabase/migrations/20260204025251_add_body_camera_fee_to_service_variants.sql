-- Add body_camera_fee to service_variants and backfill from CSV matrix (49 or 99 per variant)
ALTER TABLE public.service_variants
  ADD COLUMN IF NOT EXISTS body_camera_fee DECIMAL(10,2) DEFAULT 0.00;

COMMENT ON COLUMN public.service_variants.body_camera_fee IS 'From CSV: Body Camera Fee (49 or 99 per variant).';

-- Backfill body_camera_fee by (category, service, variant)
CREATE TEMP TABLE body_cam_backfill (
  category_slug TEXT,
  service_name TEXT,
  variant_name TEXT,
  body_camera_fee DECIMAL(10,2)
);

INSERT INTO body_cam_backfill (category_slug, service_name, variant_name, body_camera_fee) VALUES
('locksmithing', 'Home lockout assistance', 'Standard', 49.00),
('locksmithing', 'Lock installation', 'Standard', 49.00),
('locksmithing', 'Smart lock installation', 'Standard', 99.00),
('locksmithing', 'Lock repair / Re-keying', 'Standard', 49.00),
('locksmithing', 'Lock repair / Re-keying', 'Dimple Key', 49.00),
('locksmithing', 'Re-keying of dimple key', 'Standard', 99.00),
('locksmithing', 'Smart lock setup and programming', 'Standard', 99.00),
('locksmithing', 'Glass door unlocking', 'Standard', 99.00),
('locksmithing', 'Car door lockout', 'Standard', 99.00),
('locksmithing', 'Car door lockout', 'Luxury', 99.00),
('locksmithing', 'Car key duplication', 'Standard', 99.00),
('locksmithing', 'Car key duplication', 'Keyfob', 99.00),
('locksmithing', 'Key extraction', 'Standard', 49.00),
('locksmithing', 'Smart key', 'Standard', 99.00),
('locksmithing', 'Safe/Vault Opening', 'Mechanical', 99.00),
('locksmithing', 'Safe/Vault Opening', 'Digital', 99.00),
('locksmithing', 'Vault servicing and maintenance', 'Standard', 99.00),
('locksmithing', 'Digital Safe Combination reset / Code retrieval', 'Standard', 99.00),
('locksmithing', 'Key Duplication', 'Standard', 49.00),
('locksmithing', 'Key Duplication', 'High Security', 49.00),
('locksmithing', 'Key Duplication', 'Dimple Key', 49.00),
('locksmithing', 'Key Duplication', 'Laser Cut', 49.00),
('locksmithing', 'Key Duplication', 'Customized Key', 99.00),
('aircon', 'Regular Cleaning', 'Split Type - 1HP', 99.00),
('aircon', 'Regular Cleaning', 'Split Type - 1.5HP', 99.00),
('aircon', 'Regular Cleaning', 'Split Type - 2HP', 99.00),
('aircon', 'Regular Cleaning', 'Split Type - 3HP', 99.00),
('aircon', 'Regular Cleaning', 'Window (Inverter) - Any', 49.00),
('aircon', 'Regular Cleaning', 'Window (Non-Inv) - 1HP', 49.00),
('aircon', 'Regular Cleaning', 'Window (Non-Inv) - 1.5HP', 49.00),
('aircon', 'Regular Cleaning', 'Window (Non-Inv) - 2HP+', 49.00),
('aircon', 'Regular Cleaning', 'Floor Mounted', 99.00),
('aircon', 'Regular Cleaning', 'Cassette Type', 99.00),
('aircon', 'AC Repair', 'Ocular / Diagnostic', 49.00),
('aircon', 'Parts Replacement', 'Window Type - Capacitor', 99.00),
('aircon', 'Parts Replacement', 'Window Type - Fan Motor', 99.00),
('aircon', 'Parts Replacement', 'Split Type - Capacitor', 99.00),
('aircon', 'Parts Replacement', 'Split Type - Fan Motor', 99.00),
('automotive', 'Battery Jumpstart', 'Standard', 99.00),
('automotive', 'Change of Flat Tire', 'Standard', 99.00),
('automotive', 'Fuel Delivery', 'Service Fee (Fuel Cost Extra)', 99.00),
('automotive', 'Towing', 'Standard', 99.00),
('automotive', 'Towing', 'Luxury / Flatbed', 99.00),
('automotive', 'Towing', 'Parking Retrieval', 99.00),
('electrical', 'Relamping', 'Per Bulb', 49.00),
('electrical', 'Relamping', 'Standard Fixture', 49.00),
('electrical', 'Relamping', 'Chandelier', 49.00),
('electrical', 'Installation & Replacement', 'Standard Install', 49.00),
('electrical', 'Installation & Replacement', 'Complex Install', 49.00),
('electrical', 'Installation & Replacement', 'Repair / Fix', 49.00),
('electrical', 'Installation & Replacement', 'Circuit Panel', 49.00),
('electrical', 'Installation & Replacement', 'Circuit Breaker Main', 49.00),
('electrical', 'Installation & Replacement', 'Panel Box Install', 99.00),
('electrical', 'Installation & Replacement', 'Water Heater (Portable)', 99.00),
('electrical', 'Installation & Replacement', 'Water Heater (Centralized)', 99.00),
('electrical', 'Installation & Replacement', 'Ceiling Fan', 49.00),
('electrical', 'Installation & Replacement', 'Convenience Outlet', 49.00),
('electrical', 'Installation & Replacement', 'Electrical Plug', 49.00),
('electrical', 'Installation & Replacement', 'Circuit(Branch)', 49.00),
('electrical', 'Installation & Replacement', 'Main Circuit Breaker', 99.00),
('electrical', 'Installation & Replacement', 'Circuit Breaker Panel Box', 99.00),
('plumbing', 'Declogging & Siphoning', 'Declogging', 99.00),
('plumbing', 'Declogging & Siphoning', 'Drain Line Cleaning', 99.00),
('plumbing', 'Declogging & Siphoning', 'Septic Tank Siphoning', 99.00),
('plumbing', 'Declogging & Siphoning', 'Sludge Removal', 99.00),
('plumbing', 'Leak / Smoke Test', 'Leak Test', 99.00),
('plumbing', 'Leak / Smoke Test', 'Smoke Test', 99.00),
('plumbing', 'Plumbing Repair', 'Sink Repair', 49.00),
('plumbing', 'Plumbing Repair', 'Faucet Repair', 49.00),
('plumbing', 'Plumbing Repair', 'Water Heater Install', 99.00),
('plumbing', 'Plumbing Repair', 'Pipe Leak Repair', 99.00);

UPDATE public.service_variants sv
SET body_camera_fee = b.body_camera_fee,
    updated_at = NOW()
FROM body_cam_backfill b
JOIN public.services s ON s.name = b.service_name
JOIN public.service_categories sc ON sc.id = s.category_id AND sc.slug = b.category_slug
WHERE sv.service_id = s.id AND sv.name = b.variant_name;

-- Set 49 for any variant that has 0 and belongs to a known category (catch-all for any new variants)
UPDATE public.service_variants sv
SET body_camera_fee = 49.00,
    updated_at = NOW()
FROM public.services s
JOIN public.service_categories sc ON sc.id = s.category_id
WHERE sv.service_id = s.id
  AND (sv.body_camera_fee IS NULL OR sv.body_camera_fee = 0)
  AND sc.slug IN ('locksmithing', 'aircon', 'automotive', 'electrical', 'plumbing');
