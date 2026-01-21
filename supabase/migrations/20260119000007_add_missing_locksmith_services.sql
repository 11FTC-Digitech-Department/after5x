-- Add missing locksmithing services from the CSV data
DO $$
DECLARE
    cat_lock UUID;
    current_service_id UUID;
BEGIN
    -- Get locksmithing category ID
    SELECT id INTO cat_lock FROM public.service_categories WHERE slug = 'locksmithing';

    -- Key extraction service
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Key extraction') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema)
        VALUES (cat_lock, 'Key extraction', '[{"key": "situation", "type": "textarea", "label": "Describe the key extraction situation", "required": true}, {"key": "proof_ownership", "type": "checkbox", "label": "I can provide proof of ownership", "required": true}]')
        RETURNING id INTO current_service_id;

        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max)
        VALUES (current_service_id, 'Standard', 800.00, 1500.00, 1360.00, 2550.00);
    END IF;

    -- Smart key service
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Smart key') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema)
        VALUES (cat_lock, 'Smart key', '[{"key": "vehicle_make", "type": "text", "label": "Vehicle Make & Model", "required": true}, {"key": "situation", "type": "textarea", "label": "Describe the smart key issue", "required": true}]')
        RETURNING id INTO current_service_id;

        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max)
        VALUES (current_service_id, 'Standard', 7500.00, 7500.00, 12750.00, 12750.00);
    END IF;

    -- Vault servicing and maintenance
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Vault servicing and maintenance') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema)
        VALUES (cat_lock, 'Vault servicing and maintenance', '[{"key": "vault_type", "type": "text", "label": "Vault/Safe Type", "required": true}, {"key": "maintenance_type", "type": "select", "label": "Service Type", "options": ["Annual Maintenance", "Repair", "Inspection"], "required": true}]')
        RETURNING id INTO current_service_id;

        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max)
        VALUES (current_service_id, 'Standard', 5000.00, 15000.00, 8500.00, 25500.00);
    END IF;

    -- Digital Safe Combination reset / Code retrieval
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Digital Safe Combination reset / Code retrieval') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema)
        VALUES (cat_lock, 'Digital Safe Combination reset / Code retrieval', '[{"key": "safe_type", "type": "text", "label": "Safe Type/Model", "required": true}, {"key": "has_manual", "type": "checkbox", "label": "I have the user manual", "required": false}]')
        RETURNING id INTO current_service_id;

        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max)
        VALUES (current_service_id, 'Standard', 3000.00, 6000.00, 5100.00, 10200.00);
    END IF;

    -- Add customized key variant to existing Key Duplication service
    IF EXISTS (SELECT 1 FROM public.services WHERE name = 'Key Duplication') THEN
        SELECT id INTO current_service_id FROM public.services WHERE name = 'Key Duplication';

        IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = current_service_id AND name = 'Customized Key') THEN
            INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max)
            VALUES (current_service_id, 'Customized Key', 1200.00, 1500.00, 2040.00, 2550.00);
        END IF;
    END IF;

END $$;