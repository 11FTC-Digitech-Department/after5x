-- Add missing locksmith services from pricing reference
-- This migration adds services that were in the pricing PDF but missing from seed data

DO $$
DECLARE
    cat_lock UUID;
    current_service_id UUID;
    key_dup_service_id UUID;
    form_locksmith JSONB := '[{"key": "situation", "type": "textarea", "label": "Describe the lock issue", "required": true}, {"key": "proof_ownership", "type": "checkbox", "label": "I can provide proof of ownership", "required": true}]';
BEGIN
    -- Get locksmith category ID
    SELECT id INTO cat_lock FROM public.service_categories WHERE slug = 'locksmithing';

    IF cat_lock IS NULL THEN
        RAISE NOTICE 'Locksmithing category not found, skipping...';
        RETURN;
    END IF;

    -- 1. Key extraction service (800-1500 / 1360-2550)
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Key extraction') THEN
        INSERT INTO public.services (category_id, name, description, booking_form_schema)
        VALUES (cat_lock, 'Key extraction', 'Professional extraction of broken or stuck keys from locks', form_locksmith)
        RETURNING id INTO current_service_id;

        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, properties)
        VALUES (current_service_id, 'Standard', 800.00, 1500.00, 1360.00, 2550.00, '{}'::JSONB);

        RAISE NOTICE 'Added Key extraction service';
    END IF;

    -- 2. Smart key service (7500 / 12750)
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Smart key programming') THEN
        INSERT INTO public.services (category_id, name, description, booking_form_schema)
        VALUES (cat_lock, 'Smart key programming', 'Programming and replacement of smart car keys', form_locksmith)
        RETURNING id INTO current_service_id;

        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, properties)
        VALUES (current_service_id, 'Standard', 7500.00, 7500.00, 12750.00, 12750.00, '{}'::JSONB);

        RAISE NOTICE 'Added Smart key programming service';
    END IF;

    -- 3. Vault servicing and maintenance (5000-15000 / 8500-25500)
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Vault servicing and maintenance') THEN
        INSERT INTO public.services (category_id, name, description, booking_form_schema)
        VALUES (cat_lock, 'Vault servicing and maintenance', 'Regular maintenance and servicing of vaults and safes', form_locksmith)
        RETURNING id INTO current_service_id;

        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, properties)
        VALUES (current_service_id, 'Standard', 5000.00, 15000.00, 8500.00, 25500.00, '{}'::JSONB);

        RAISE NOTICE 'Added Vault servicing and maintenance service';
    END IF;

    -- 4. Digital Safe Combination reset / Code retrieval (3000-6000 / 5100-10200)
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Digital Safe Combination Reset') THEN
        INSERT INTO public.services (category_id, name, description, booking_form_schema)
        VALUES (cat_lock, 'Digital Safe Combination Reset', 'Reset or retrieve combination codes for digital safes', form_locksmith)
        RETURNING id INTO current_service_id;

        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, properties)
        VALUES (current_service_id, 'Standard', 3000.00, 6000.00, 5100.00, 10200.00, '{}'::JSONB);

        RAISE NOTICE 'Added Digital Safe Combination Reset service';
    END IF;

    -- 5. Add Customized Key variant to Key Duplication service (1200-1500 / 2040-2550)
    SELECT id INTO key_dup_service_id FROM public.services WHERE name = 'Key Duplication';

    IF key_dup_service_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE service_id = key_dup_service_id AND name = 'Customized Key') THEN
            INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max, properties)
            VALUES (key_dup_service_id, 'Customized Key', 1200.00, 1500.00, 2040.00, 2550.00, '{"key_type": "customized"}'::JSONB);

            -- Update the variant_selection_schema to include customized key option
            UPDATE public.services
            SET variant_selection_schema = '{
                "selectors": [
                    {
                        "key": "key_type",
                        "label": "Key Type",
                        "type": "select",
                        "options": [
                            {"value": "standard", "label": "Standard Key"},
                            {"value": "high_security", "label": "High Security Key"},
                            {"value": "dimple", "label": "Dimple Key"},
                            {"value": "laser_cut", "label": "Laser Cut Key"},
                            {"value": "customized", "label": "Customized Key"}
                        ]
                    }
                ]
            }'::JSONB
            WHERE id = key_dup_service_id;

            RAISE NOTICE 'Added Customized Key variant to Key Duplication service';
        END IF;
    END IF;

END $$;

-- Add provider offerings for the new services (link to masterlock provider)
DO $$
DECLARE
    provider_masterlock UUID;
    var_record RECORD;
BEGIN
    -- Find masterlock provider by profile name pattern
    SELECT p.id INTO provider_masterlock
    FROM public.providers p
    JOIN public.profiles pr ON p.id = pr.id
    WHERE pr.full_name LIKE '%Masterlock%'
    LIMIT 1;

    IF provider_masterlock IS NOT NULL THEN
        -- Add offerings for all new locksmith service variants
        FOR var_record IN
            SELECT sv.id
            FROM public.service_variants sv
            JOIN public.services s ON sv.service_id = s.id
            JOIN public.service_categories sc ON s.category_id = sc.id
            WHERE sc.slug = 'locksmithing'
            AND NOT EXISTS (
                SELECT 1 FROM public.provider_offerings po
                WHERE po.provider_id = provider_masterlock
                AND po.service_variant_id = sv.id
            )
        LOOP
            INSERT INTO public.provider_offerings (provider_id, service_variant_id, is_active)
            VALUES (provider_masterlock, var_record.id, true)
            ON CONFLICT (provider_id, service_variant_id) DO NOTHING;
        END LOOP;

        RAISE NOTICE 'Added provider offerings for masterlock provider';
    ELSE
        RAISE NOTICE 'Masterlock provider not found, skipping provider offerings';
    END IF;
END $$;
