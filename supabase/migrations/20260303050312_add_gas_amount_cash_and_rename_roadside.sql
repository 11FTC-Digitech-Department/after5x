-- Fuel Delivery: gas_amount_fee, rename Automotive→Roadside Assistance, 3 gas variants, same price both tiers

-- 1. Add gas_amount_fee for Fuel Delivery (amount PHP customer pays in cash to provider, excluded from grand_total)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS gas_amount_fee INTEGER NULL;

-- 2. Rename Automotive category to Roadside Assistance for display
UPDATE public.service_categories SET name = 'Roadside Assistance' WHERE slug = 'automotive';

-- 3. Add 3 Fuel Delivery variants (₱500, ₱1,000, ₱1,500 gas) + variant_selection_schema
DO $$
DECLARE
  fuel_delivery_id UUID;
  existing_variant_id UUID;
  new_var_1000_id UUID;
  new_var_1500_id UUID;
  prov RECORD;
BEGIN
  SELECT s.id INTO fuel_delivery_id FROM public.services s
    JOIN public.service_categories sc ON s.category_id = sc.id
    WHERE s.name = 'Fuel Delivery' AND sc.slug = 'automotive';

  IF fuel_delivery_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.service_variants
  SET name = '₱500 gas', properties = '{"gas_amount_fee": 500}'::JSONB
  WHERE service_id = fuel_delivery_id AND name = 'Service Fee (Fuel Cost Extra)'
  RETURNING id INTO existing_variant_id;

  INSERT INTO public.service_variants (
    service_id, name, price_min, price_max, price_after5_min, price_after5_max,
    transportation_fee, transportation_fee_after5, urgent_charge, vat_rate,
    commission_rate, body_camera_fee, duration_minutes, properties, is_active
  )
  SELECT fuel_delivery_id, '₱1,000 gas', price_min, price_max, price_after5_min, price_after5_max,
    transportation_fee, transportation_fee_after5, urgent_charge, vat_rate,
    commission_rate, body_camera_fee, duration_minutes,
    '{"gas_amount_fee": 1000}'::JSONB, true
  FROM public.service_variants WHERE id = existing_variant_id
  RETURNING id INTO new_var_1000_id;

  INSERT INTO public.service_variants (
    service_id, name, price_min, price_max, price_after5_min, price_after5_max,
    transportation_fee, transportation_fee_after5, urgent_charge, vat_rate,
    commission_rate, body_camera_fee, duration_minutes, properties, is_active
  )
  SELECT fuel_delivery_id, '₱1,500 gas', price_min, price_max, price_after5_min, price_after5_max,
    transportation_fee, transportation_fee_after5, urgent_charge, vat_rate,
    commission_rate, body_camera_fee, duration_minutes,
    '{"gas_amount_fee": 1500}'::JSONB, true
  FROM public.service_variants WHERE id = existing_variant_id
  RETURNING id INTO new_var_1500_id;

  UPDATE public.services SET variant_selection_schema = '{
    "selectors": [
      {"key": "gas_amount_fee", "label": "Gas Amount (paid in cash)", "type": "select",
       "options": [{"value": 500, "label": "₱500"}, {"value": 1000, "label": "₱1,000"}, {"value": 1500, "label": "₱1,500"}]}
    ]
  }'::JSONB
  WHERE id = fuel_delivery_id;

  FOR prov IN
    SELECT DISTINCT po.provider_id
    FROM public.provider_offerings po
    JOIN public.service_variants sv ON po.service_variant_id = sv.id
    WHERE sv.service_id = fuel_delivery_id AND po.is_active = true
  LOOP
    INSERT INTO public.provider_offerings (provider_id, service_variant_id)
    VALUES (prov.provider_id, new_var_1000_id)
    ON CONFLICT (provider_id, service_variant_id) DO NOTHING;
    INSERT INTO public.provider_offerings (provider_id, service_variant_id)
    VALUES (prov.provider_id, new_var_1500_id)
    ON CONFLICT (provider_id, service_variant_id) DO NOTHING;
  END LOOP;

END $$;

-- 4. Fuel Delivery: same price for standard and after 5PM (no premium)
UPDATE public.service_variants
SET price_after5_min = price_min, price_after5_max = price_max
WHERE service_id IN (SELECT s.id FROM public.services s JOIN public.service_categories sc ON s.category_id = sc.id WHERE s.name = 'Fuel Delivery' AND sc.slug = 'automotive');
