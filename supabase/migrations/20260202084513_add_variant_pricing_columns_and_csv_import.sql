-- ============================================================================
-- Rebuild: All pricing config on service_variants only (no rules tables)
-- ============================================================================
-- 1. Drop rules tables and old functions if they exist
-- 2. Add columns to service_variants (transportation_fee_after5, urgent_charge)
-- 3. Set default fees on all variants from CSV (49/129 transport, 500 urgent, 15% commission, 12% VAT)
-- 4. Update variant prices from CSV matrix + add missing services/variants
-- ============================================================================

-- ============================================================================
-- PART 1: Drop rules tables and old functions (if they exist)
-- ============================================================================

DROP TABLE IF EXISTS public.service_pricing_rules;
DROP TABLE IF EXISTS public.service_rule_types;

-- ============================================================================
-- PART 2: Add columns to service_variants
-- ============================================================================

ALTER TABLE public.service_variants
  ADD COLUMN IF NOT EXISTS transportation_fee_after5 DECIMAL(10,2) DEFAULT 129.00,
  ADD COLUMN IF NOT EXISTS urgent_charge DECIMAL(10,2) DEFAULT 500.00,
  ADD COLUMN IF NOT EXISTS cleaning_type TEXT,
  ADD COLUMN IF NOT EXISTS configuration TEXT,
  ADD COLUMN IF NOT EXISTS fuel_cost DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS commission_amount_min_8to5 DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS commission_amount_min_5to8 DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS commission_amount_max_8to5 DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS commission_amount_max_5to8 DECIMAL(10,2);

COMMENT ON COLUMN public.service_variants.transportation_fee IS 'Transportation fee regular hours (8AM-5PM). From CSV: 49.00';
COMMENT ON COLUMN public.service_variants.transportation_fee_after5 IS 'Transportation fee after-hours (5PM-8AM). From CSV: 129.00';
COMMENT ON COLUMN public.service_variants.urgent_charge IS 'Urgent/emergency charge. From CSV: 500.00';
COMMENT ON COLUMN public.service_variants.cleaning_type IS 'From CSV: Cleaning_Type (e.g. Deep).';
COMMENT ON COLUMN public.service_variants.configuration IS 'From CSV: Configuration (e.g. AC hp options).';
COMMENT ON COLUMN public.service_variants.fuel_cost IS 'From CSV: Fuel Cost.';
COMMENT ON COLUMN public.service_variants.commission_amount_min_8to5 IS 'From CSV: Commission amount minimum 8AM-5PM.';
COMMENT ON COLUMN public.service_variants.commission_amount_min_5to8 IS 'From CSV: Commission amount minimum 5PM-8AM.';
COMMENT ON COLUMN public.service_variants.commission_amount_max_8to5 IS 'From CSV: Commission amount maximum 8AM-5PM.';
COMMENT ON COLUMN public.service_variants.commission_amount_max_5to8 IS 'From CSV: Commission amount maximum 5PM-8AM.';

-- Computed columns (equations from CSV: base + transport, base + urgent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_regular_min_with_transport') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_regular_min_with_transport DECIMAL(10,2) GENERATED ALWAYS AS (price_min + COALESCE(transportation_fee, 49.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_regular_max_with_transport') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_regular_max_with_transport DECIMAL(10,2) GENERATED ALWAYS AS (price_max + COALESCE(transportation_fee, 49.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_after5_min_with_transport') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_after5_min_with_transport DECIMAL(10,2) GENERATED ALWAYS AS (price_after5_min + COALESCE(transportation_fee_after5, 129.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_after5_max_with_transport') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_after5_max_with_transport DECIMAL(10,2) GENERATED ALWAYS AS (price_after5_max + COALESCE(transportation_fee_after5, 129.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_regular_min_with_urgent') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_regular_min_with_urgent DECIMAL(10,2) GENERATED ALWAYS AS (price_min + COALESCE(urgent_charge, 500.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_regular_max_with_urgent') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_regular_max_with_urgent DECIMAL(10,2) GENERATED ALWAYS AS (price_max + COALESCE(urgent_charge, 500.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_after5_min_with_urgent') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_after5_min_with_urgent DECIMAL(10,2) GENERATED ALWAYS AS (price_after5_min + COALESCE(urgent_charge, 500.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_after5_max_with_urgent') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_after5_max_with_urgent DECIMAL(10,2) GENERATED ALWAYS AS (price_after5_max + COALESCE(urgent_charge, 500.00)) STORED;
  END IF;
  -- Price shown in app ... + Urgent (base + transport + urgent)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_regular_min_with_transport_and_urgent') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_regular_min_with_transport_and_urgent DECIMAL(10,2) GENERATED ALWAYS AS (price_min + COALESCE(transportation_fee, 49.00) + COALESCE(urgent_charge, 500.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_regular_max_with_transport_and_urgent') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_regular_max_with_transport_and_urgent DECIMAL(10,2) GENERATED ALWAYS AS (price_max + COALESCE(transportation_fee, 49.00) + COALESCE(urgent_charge, 500.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_after5_min_with_transport_and_urgent') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_after5_min_with_transport_and_urgent DECIMAL(10,2) GENERATED ALWAYS AS (price_after5_min + COALESCE(transportation_fee_after5, 129.00) + COALESCE(urgent_charge, 500.00)) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_variants' AND column_name = 'price_after5_max_with_transport_and_urgent') THEN
    ALTER TABLE public.service_variants ADD COLUMN price_after5_max_with_transport_and_urgent DECIMAL(10,2) GENERATED ALWAYS AS (price_after5_max + COALESCE(transportation_fee_after5, 129.00) + COALESCE(urgent_charge, 500.00)) STORED;
  END IF;
END $$;

COMMENT ON COLUMN public.service_variants.price_regular_min_with_transport IS 'Computed: price_min + transportation_fee (Price for Regular Hours Minimum +49).';
COMMENT ON COLUMN public.service_variants.price_regular_max_with_transport IS 'Computed: price_max + transportation_fee (Price for Regular Hours Maximum +49).';
COMMENT ON COLUMN public.service_variants.price_after5_min_with_transport IS 'Computed: price_after5_min + transportation_fee_after5 (Price for After5 Hours Minimum +129).';
COMMENT ON COLUMN public.service_variants.price_after5_max_with_transport IS 'Computed: price_after5_max + transportation_fee_after5 (Price for After5 Hours Maximum +129).';
COMMENT ON COLUMN public.service_variants.price_regular_min_with_urgent IS 'Computed: price_min + urgent_charge (Regular Hours Minimum + Urgent).';
COMMENT ON COLUMN public.service_variants.price_regular_max_with_urgent IS 'Computed: price_max + urgent_charge (Regular Hours Maximum + Urgent).';
COMMENT ON COLUMN public.service_variants.price_after5_min_with_urgent IS 'Computed: price_after5_min + urgent_charge (After5 Hours Minimum + Urgent).';
COMMENT ON COLUMN public.service_variants.price_after5_max_with_urgent IS 'Computed: price_after5_max + urgent_charge (After5 Hours Maximum + Urgent).';
COMMENT ON COLUMN public.service_variants.price_regular_min_with_transport_and_urgent IS 'Computed: price_min + transport + urgent (Price shown in app Regular hours Min + Urgent).';
COMMENT ON COLUMN public.service_variants.price_regular_max_with_transport_and_urgent IS 'Computed: price_max + transport + urgent (Price shown in app Regular hours Max + Urgent).';
COMMENT ON COLUMN public.service_variants.price_after5_min_with_transport_and_urgent IS 'Computed: price_after5_min + transport_after5 + urgent (Price shown in app After5 hours Min + Urgent).';
COMMENT ON COLUMN public.service_variants.price_after5_max_with_transport_and_urgent IS 'Computed: price_after5_max + transport_after5 + urgent (Price shown in app After5 hours Max + Urgent).';

-- ============================================================================
-- PART 3: Set default fees on all variants (from CSV matrix)
-- ============================================================================

UPDATE public.service_variants
SET
  transportation_fee = COALESCE(transportation_fee, 49.00),
  transportation_fee_after5 = COALESCE(transportation_fee_after5, 129.00),
  urgent_charge = COALESCE(urgent_charge, 500.00),
  commission_rate = COALESCE(commission_rate, 15.00),
  vat_rate = COALESCE(vat_rate, 0.12),
  updated_at = NOW();

-- ============================================================================
-- PART 4: Update variant prices from CSV matrix + add missing services/variants
-- ============================================================================

-- Add missing Locksmithing services/variants from CSV (not in seed)
DO $$
DECLARE
  v_service_id UUID;
  v_locksmith_id UUID;
  form_locksmith JSONB := '[{"key": "situation", "type": "textarea", "label": "Describe the lock issue", "required": true}, {"key": "proof_ownership", "type": "checkbox", "label": "I can provide proof of ownership", "required": true}]';
BEGIN
  SELECT id INTO v_locksmith_id FROM public.service_categories WHERE slug = 'locksmithing';
  IF v_locksmith_id IS NULL THEN RETURN; END IF;

  -- Re-keying of dimple key / Standard
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Re-keying of dimple key') THEN
    INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (v_locksmith_id, 'Re-keying of dimple key', form_locksmith) RETURNING id INTO v_service_id;
    INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
    VALUES (v_service_id, 'Standard', 1950.00, 1950.00, 3315.00, 3315.00, 49.00, 129.00, 500.00, 15.00, 0.12);
  END IF;

  -- Key Extraction / Standard
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Key Extraction') THEN
    INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (v_locksmith_id, 'Key Extraction', form_locksmith) RETURNING id INTO v_service_id;
    INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
    VALUES (v_service_id, 'Standard', 800.00, 1500.00, 1360.00, 2550.00, 49.00, 129.00, 500.00, 15.00, 0.12);
  END IF;

  -- Smart key / Standard
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Smart key') THEN
    INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (v_locksmith_id, 'Smart key', form_locksmith) RETURNING id INTO v_service_id;
    INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
    VALUES (v_service_id, 'Standard', 7500.00, 7500.00, 12750.00, 12750.00, 49.00, 129.00, 500.00, 15.00, 0.12);
  END IF;

  -- Vault servicing and maintenance / Standard
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Vault servicing and maintenance') THEN
    INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (v_locksmith_id, 'Vault servicing and maintenance', form_locksmith) RETURNING id INTO v_service_id;
    INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
    VALUES (v_service_id, 'Standard', 5000.00, 15000.00, 8500.00, 25500.00, 49.00, 129.00, 500.00, 15.00, 0.12);
  END IF;

  -- Digital Safe Combination reset / Code retrieval / Standard
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Digital Safe Combination reset / Code retrieval') THEN
    INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (v_locksmith_id, 'Digital Safe Combination reset / Code retrieval', form_locksmith) RETURNING id INTO v_service_id;
    INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
    VALUES (v_service_id, 'Standard', 3000.00, 6000.00, 5100.00, 10200.00, 49.00, 129.00, 500.00, 15.00, 0.12);
  END IF;
END $$;

-- Add missing Relamping - Chandelier variant (CSV row 41)
DO $$
DECLARE
  v_service_id UUID;
BEGIN
  SELECT s.id INTO v_service_id FROM public.services s JOIN public.service_categories sc ON s.category_id = sc.id WHERE s.name = 'Relamping' AND sc.slug = 'electrical';
  IF v_service_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = v_service_id AND name = 'Chandelier') THEN
    INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
    VALUES (v_service_id, 'Chandelier', 250.00, 250.00, 425.00, 425.00, 49.00, 129.00, 500.00, 15.00, 0.12);
  END IF;
END $$;

-- Add missing Key Duplication - Customized Key variant (CSV row 23: customized key)
DO $$
DECLARE
  v_service_id UUID;
BEGIN
  SELECT s.id INTO v_service_id FROM public.services s JOIN public.service_categories sc ON s.category_id = sc.id WHERE s.name = 'Key Duplication' AND sc.slug = 'locksmithing';
  IF v_service_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = v_service_id AND name = 'Customized Key') THEN
    INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
    VALUES (v_service_id, 'Customized Key', 1200.00, 1500.00, 2040.00, 2550.00, 49.00, 129.00, 500.00, 15.00, 0.12);
  END IF;
END $$;

-- Add missing Installation & Replacement variants (Ceiling Fan, Convenience Outlet, etc.)
DO $$
DECLARE
  v_service_id UUID;
BEGIN
  SELECT s.id INTO v_service_id FROM public.services s JOIN public.service_categories sc ON s.category_id = sc.id WHERE s.name = 'Installation & Replacement' AND sc.slug = 'electrical';
  IF v_service_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = v_service_id AND name = 'Ceiling Fan') THEN
      INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
      VALUES (v_service_id, 'Ceiling Fan', 300.00, 300.00, 510.00, 510.00, 49.00, 129.00, 500.00, 15.00, 0.12);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = v_service_id AND name = 'Convenience Outlet') THEN
      INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
      VALUES (v_service_id, 'Convenience Outlet', 200.00, 200.00, 340.00, 340.00, 49.00, 129.00, 500.00, 15.00, 0.12);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = v_service_id AND name = 'Electrical Plug') THEN
      INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
      VALUES (v_service_id, 'Electrical Plug', 100.00, 100.00, 170.00, 170.00, 49.00, 129.00, 500.00, 15.00, 0.12);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = v_service_id AND name = 'Circuit(Branch)') THEN
      INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
      VALUES (v_service_id, 'Circuit(Branch)', 500.00, 500.00, 850.00, 850.00, 49.00, 129.00, 500.00, 15.00, 0.12);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = v_service_id AND name = 'Main Circuit Breaker') THEN
      INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
      VALUES (v_service_id, 'Main Circuit Breaker', 1000.00, 1000.00, 1700.00, 1700.00, 49.00, 129.00, 500.00, 15.00, 0.12);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = v_service_id AND name = 'Circuit Breaker Panel Box') THEN
      INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, transportation_fee, transportation_fee_after5, urgent_charge, commission_rate, vat_rate)
      VALUES (v_service_id, 'Circuit Breaker Panel Box', 3000.00, 3000.00, 5100.00, 5100.00, 49.00, 129.00, 500.00, 15.00, 0.12);
    END IF;
  END IF;
END $$;

-- Create temp table with CSV matrix data and update existing variants
CREATE TEMP TABLE csv_matrix_data (
  category_type TEXT,
  service_name TEXT,
  variant_name TEXT,
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  price_after5_min DECIMAL(10,2),
  price_after5_max DECIMAL(10,2),
  cleaning_type TEXT,
  configuration TEXT,
  fuel_cost DECIMAL(10,2),
  commission_amount_min_8to5 DECIMAL(10,2),
  commission_amount_min_5to8 DECIMAL(10,2),
  commission_amount_max_8to5 DECIMAL(10,2),
  commission_amount_max_5to8 DECIMAL(10,2)
);

INSERT INTO csv_matrix_data (category_type, service_name, variant_name, price_min, price_max, price_after5_min, price_after5_max, cleaning_type, configuration, fuel_cost, commission_amount_min_8to5, commission_amount_min_5to8, commission_amount_max_8to5, commission_amount_max_5to8) VALUES
('Locksmithing', 'Home lockout assistance', 'Standard', 800.00, 1500.00, 1360.00, 2550.00, 'Deep', '0.5hp, 0.75hp, 1hp, 1.25hp, 1.5hp, 2hp, 2.5hp, 3hp', 100.00, 120.00, 204.00, 225.00, 382.50),
('Locksmithing', 'Lock installation', 'Standard', 750.00, 1200.00, 1275.00, 2040.00, NULL, NULL, 500.00, 112.50, 191.25, 180.00, 306.00),
('Locksmithing', 'Smart lock installation', 'Standard', 2500.00, 2500.00, 4250.00, 4250.00, NULL, NULL, 1000.00, 375.00, 637.50, NULL, NULL),
('Locksmithing', 'Lock repair / Re-keying', 'Standard', 950.00, 1500.00, 1615.00, 2550.00, NULL, NULL, NULL, 142.50, 242.25, 225.00, 382.50),
('Locksmithing', 'Lock repair / Re-keying', 'Dimple Key', 1950.00, 1950.00, 3315.00, 3315.00, NULL, NULL, NULL, 142.50, 242.25, 225.00, 382.50),
('Locksmithing', 'Re-keying of dimple key', 'Standard', 1950.00, 1950.00, 3315.00, 3315.00, NULL, NULL, NULL, 292.50, 497.25, NULL, NULL),
('Locksmithing', 'Smart lock setup and programming', 'Standard', 1500.00, 3000.00, 2550.00, 5100.00, NULL, NULL, NULL, 225.00, 382.50, 450.00, 765.00),
('Locksmithing', 'Glass door unlocking', 'Standard', 1250.00, 1250.00, 2125.00, 2125.00, NULL, NULL, NULL, 187.50, 318.75, NULL, NULL),
('Locksmithing', 'Car door lockout', 'Standard', 1250.00, 1950.00, 2125.00, 3315.00, NULL, NULL, NULL, 187.50, 318.75, 292.50, 497.25),
('Locksmithing', 'Car door lockout', 'Luxury', 2500.00, 3000.00, 4250.00, 5100.00, NULL, NULL, NULL, 375.00, 637.50, 450.00, 765.00),
('Locksmithing', 'Car key duplication', 'Standard', 700.00, 1200.00, 1190.00, 2040.00, NULL, NULL, NULL, 105.00, 178.50, 180.00, 306.00),
('Locksmithing', 'Car key duplication', 'Keyfob', 2500.00, 4500.00, 4250.00, 7650.00, NULL, NULL, NULL, 375.00, 637.50, 675.00, 1147.50),
('Locksmithing', 'Key extraction', 'Standard', 800.00, 1500.00, 1360.00, 2550.00, NULL, NULL, NULL, 120.00, 204.00, 225.00, 382.50),
('Locksmithing', 'Smart key', 'Standard', 7500.00, 7500.00, 12750.00, 12750.00, NULL, NULL, NULL, 1125.00, 1912.50, NULL, NULL),
('Locksmithing', 'Safe/Vault Opening', 'Mechanical', 2500.00, 5000.00, 4250.00, 8500.00, NULL, NULL, NULL, 375.00, 637.50, 750.00, 1275.00),
('Locksmithing', 'Safe/Vault Opening', 'Digital', 3000.00, 6000.00, 5100.00, 10200.00, NULL, NULL, NULL, 450.00, 765.00, 900.00, 1530.00),
('Locksmithing', 'Vault servicing and maintenance', 'Standard', 5000.00, 15000.00, 8500.00, 25500.00, NULL, NULL, NULL, 750.00, 1275.00, 2250.00, 3825.00),
('Locksmithing', 'Digital Safe Combination reset / Code retrieval', 'Standard', 3000.00, 6000.00, 5100.00, 10200.00, NULL, NULL, NULL, 450.00, 765.00, 900.00, 1530.00),
('Locksmithing', 'Key Duplication', 'Standard', 150.00, 150.00, 255.00, 255.00, NULL, NULL, 500.00, 22.50, 33.75, NULL, NULL),
('Locksmithing', 'Key Duplication', 'High Security', 500.00, 500.00, 850.00, 850.00, NULL, NULL, 500.00, 75.00, 127.50, NULL, NULL),
('Locksmithing', 'Key Duplication', 'Dimple Key', 850.00, 850.00, 1445.00, 1445.00, NULL, NULL, 500.00, 127.50, 216.75, NULL, NULL),
('Locksmithing', 'Key Duplication', 'Laser Cut', 950.00, 950.00, 1615.00, 1615.00, NULL, NULL, 500.00, 142.50, 242.25, NULL, NULL),
('Locksmithing', 'Key Duplication', 'Customized Key', 1200.00, 1500.00, 2040.00, 2550.00, NULL, NULL, 500.00, 180.00, 306.00, 225.00, 382.50),
('AC', 'Regular Cleaning', 'Split Type - 1HP', 1200.00, 1200.00, 2040.00, 2040.00, NULL, NULL, 500.00, 180.00, 306.00, NULL, NULL),
('AC', 'Regular Cleaning', 'Split Type - 1.5HP', 1200.00, 1200.00, 2040.00, 2040.00, NULL, NULL, 500.00, 180.00, 306.00, NULL, NULL),
('AC', 'Regular Cleaning', 'Split Type - 2HP', 1500.00, 1500.00, 2550.00, 2550.00, NULL, NULL, 500.00, 225.00, 382.50, NULL, NULL),
('AC', 'Regular Cleaning', 'Split Type - 3HP', 1500.00, 1500.00, 2550.00, 2550.00, NULL, NULL, 500.00, 225.00, 382.50, NULL, NULL),
('AC', 'Regular Cleaning', 'Window (Inverter) - Any', 700.00, 700.00, 1190.00, 1190.00, NULL, NULL, 500.00, 105.00, 178.50, NULL, NULL),
('AC', 'Regular Cleaning', 'Window (Non-Inv) - 1HP', 500.00, 500.00, 850.00, 850.00, NULL, NULL, 500.00, 75.00, 127.50, NULL, NULL),
('AC', 'Regular Cleaning', 'Window (Non-Inv) - 1.5HP', 500.00, 500.00, 850.00, 850.00, NULL, NULL, 500.00, 75.00, 127.50, NULL, NULL),
('AC', 'Regular Cleaning', 'Window (Non-Inv) - 2HP+', 600.00, 600.00, 1020.00, 1020.00, NULL, NULL, 500.00, 90.00, 153.00, NULL, NULL),
('AC', 'Regular Cleaning', 'Floor Mounted', 3000.00, 3000.00, 5100.00, 5100.00, NULL, NULL, 500.00, 450.00, 765.00, NULL, NULL),
('AC', 'Regular Cleaning', 'Cassette Type', 5500.00, 5500.00, 9350.00, 9350.00, NULL, NULL, 500.00, 825.00, 1402.50, NULL, NULL),
('AC', 'AC Repair', 'Ocular / Diagnostic', 500.00, 500.00, 850.00, 850.00, NULL, NULL, 500.00, 75.00, 127.50, NULL, NULL),
('AC', 'Parts Replacement', 'Window Type - Capacitor', 3500.00, 3500.00, 5950.00, 5950.00, NULL, NULL, 500.00, 525.00, 892.50, NULL, NULL),
('AC', 'Parts Replacement', 'Window Type - Fan Motor', 3000.00, 3000.00, 5100.00, 5100.00, NULL, NULL, 500.00, 450.00, 765.00, NULL, NULL),
('AC', 'Parts Replacement', 'Split Type - Capacitor', 3500.00, 3500.00, 5950.00, 5950.00, NULL, NULL, 500.00, 525.00, 892.50, NULL, NULL),
('AC', 'Parts Replacement', 'Split Type - Fan Motor', 3000.00, 3000.00, 5100.00, 5100.00, NULL, NULL, 500.00, 450.00, 765.00, NULL, NULL),
('Roadside Assistance', 'Battery Jumpstart', 'Standard', 1500.00, 1500.00, 2550.00, 2550.00, NULL, NULL, 500.00, 225.00, 382.50, NULL, NULL),
('Roadside Assistance', 'Change of Flat Tire', 'Standard', 1500.00, 1500.00, 2550.00, 2550.00, NULL, NULL, 500.00, 225.00, 382.50, NULL, NULL),
('Roadside Assistance', 'Fuel Delivery', 'Service Fee (Fuel Cost Extra)', 1500.00, 1500.00, 2550.00, 2550.00, NULL, NULL, 500.00, 225.00, 382.50, NULL, NULL),
('Roadside Assistance', 'Towing', 'Standard', 3500.00, 3500.00, 5950.00, 5950.00, NULL, NULL, 500.00, 525.00, 892.50, NULL, NULL),
('Roadside Assistance', 'Towing', 'Luxury / Flatbed', 7000.00, 7000.00, 11900.00, 11900.00, NULL, NULL, 500.00, 1050.00, 1785.00, NULL, NULL),
('Roadside Assistance', 'Towing', 'Parking Retrieval', 3500.00, 3500.00, 5950.00, 5950.00, NULL, NULL, 500.00, 525.00, 892.50, NULL, NULL),
('Electrical', 'Relamping', 'Per Bulb', 100.00, 100.00, 170.00, 170.00, NULL, NULL, 500.00, 15.00, 25.50, NULL, NULL),
('Electrical', 'Relamping', 'Standard Fixture', 250.00, 250.00, 425.00, 425.00, NULL, NULL, 500.00, 37.50, 63.75, NULL, NULL),
('Electrical', 'Relamping', 'Chandelier', 250.00, 250.00, 425.00, 425.00, NULL, NULL, 500.00, 37.50, 63.75, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Standard Install', 250.00, 250.00, 425.00, 425.00, NULL, NULL, 500.00, 37.50, 63.75, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Complex Install', 300.00, 300.00, 510.00, 510.00, NULL, NULL, 500.00, 45.00, 76.50, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Repair / Fix', 200.00, 200.00, 340.00, 340.00, NULL, NULL, 500.00, 30.00, 51.00, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Circuit Panel', 100.00, 100.00, 170.00, 170.00, NULL, NULL, 500.00, 15.00, 25.50, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Circuit Breaker Main', 500.00, 500.00, 850.00, 850.00, NULL, NULL, 500.00, 75.00, 127.50, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Panel Box Install', 1000.00, 1000.00, 1700.00, 1700.00, NULL, NULL, 500.00, 150.00, 255.00, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Water Heater (Portable)', 1000.00, 1000.00, 1700.00, 1700.00, NULL, NULL, 500.00, 150.00, 255.00, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Water Heater (Centralized)', 2000.00, 2000.00, 3400.00, 3400.00, NULL, NULL, 500.00, 300.00, 510.00, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Ceiling Fan', 300.00, 300.00, 510.00, 510.00, NULL, NULL, 500.00, 45.00, 76.50, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Convenience Outlet', 200.00, 200.00, 340.00, 340.00, NULL, NULL, 500.00, 30.00, 51.00, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Electrical Plug', 100.00, 100.00, 170.00, 170.00, NULL, NULL, 500.00, 15.00, 25.50, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Circuit(Branch)', 500.00, 500.00, 850.00, 850.00, NULL, NULL, 500.00, 75.00, 127.50, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Main Circuit Breaker', 1000.00, 1000.00, 1700.00, 1700.00, NULL, NULL, 500.00, 150.00, 255.00, NULL, NULL),
('Electrical', 'Installation & Replacement', 'Circuit Breaker Panel Box', 3000.00, 3000.00, 5100.00, 5100.00, NULL, NULL, 500.00, 450.00, 765.00, NULL, NULL),
('Plumbing', 'Declogging & Siphoning', 'Declogging', 1500.00, 1500.00, 2550.00, 2550.00, NULL, NULL, 500.00, 225.00, 382.50, NULL, NULL),
('Plumbing', 'Declogging & Siphoning', 'Drain Line Cleaning', 2000.00, 2000.00, 3400.00, 3400.00, NULL, NULL, 500.00, 300.00, 510.00, NULL, NULL),
('Plumbing', 'Declogging & Siphoning', 'Septic Tank Siphoning', 3500.00, 3500.00, 5950.00, 5950.00, NULL, NULL, 500.00, 525.00, 892.50, NULL, NULL),
('Plumbing', 'Declogging & Siphoning', 'Sludge Removal', 7000.00, 7000.00, 11900.00, 11900.00, NULL, NULL, 500.00, 1050.00, 1785.00, NULL, NULL),
('Plumbing', 'Leak / Smoke Test', 'Leak Test', 1500.00, 1500.00, 2550.00, 2550.00, NULL, NULL, 500.00, 225.00, 382.50, NULL, NULL),
('Plumbing', 'Leak / Smoke Test', 'Smoke Test', 1500.00, 1500.00, 2550.00, 2550.00, NULL, NULL, 500.00, 225.00, 382.50, NULL, NULL),
('Plumbing', 'Plumbing Repair', 'Sink Repair', 300.00, 300.00, 510.00, 510.00, NULL, NULL, 500.00, 45.00, 76.50, NULL, NULL),
('Plumbing', 'Plumbing Repair', 'Faucet Repair', 150.00, 150.00, 255.00, 255.00, NULL, NULL, 500.00, 22.50, 38.25, NULL, NULL),
('Plumbing', 'Plumbing Repair', 'Water Heater Install', 1500.00, 1500.00, 2550.00, 2550.00, NULL, NULL, 500.00, 225.00, 382.50, NULL, NULL),
('Plumbing', 'Plumbing Repair', 'Pipe Leak Repair', 800.00, 5000.00, 1360.00, 8500.00, NULL, NULL, 500.00, 120.00, 204.00, 750.00, 1275.00);

CREATE TEMP TABLE category_mapping AS
SELECT
  CASE category_type
    WHEN 'Locksmithing' THEN 'locksmithing'
    WHEN 'AC' THEN 'aircon'
    WHEN 'Roadside Assistance' THEN 'automotive'
    WHEN 'Electrical' THEN 'electrical'
    WHEN 'Plumbing' THEN 'plumbing'
  END AS category_slug,
  csv.*
FROM csv_matrix_data csv;

UPDATE public.service_variants sv
SET
  price_min = csv.price_min,
  price_max = csv.price_max,
  price_after5_min = csv.price_after5_min,
  price_after5_max = csv.price_after5_max,
  transportation_fee = 49.00,
  transportation_fee_after5 = 129.00,
  urgent_charge = 500.00,
  commission_rate = 15.00,
  vat_rate = 0.12,
  cleaning_type = csv.cleaning_type,
  configuration = csv.configuration,
  fuel_cost = COALESCE(csv.fuel_cost, 0.00),
  commission_amount_min_8to5 = COALESCE(csv.commission_amount_min_8to5, 0.00),
  commission_amount_min_5to8 = COALESCE(csv.commission_amount_min_5to8, 0.00),
  commission_amount_max_8to5 = COALESCE(csv.commission_amount_max_8to5, 0.00),
  commission_amount_max_5to8 = COALESCE(csv.commission_amount_max_5to8, 0.00),
  updated_at = NOW()
FROM category_mapping csv
JOIN public.services s ON s.name = csv.service_name
JOIN public.service_categories sc ON sc.id = s.category_id AND sc.slug = csv.category_slug
WHERE sv.service_id = s.id AND sv.name = csv.variant_name;
