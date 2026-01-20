-- Populate properties from existing variant names
-- This migration parses existing variant names to structured properties

DO $$
DECLARE
    aircon_regular_id UUID;
    aircon_deep_id UUID;
    aircon_repair_id UUID;
    aircon_parts_id UUID;
    lock_car_door_id UUID;
    lock_key_dup_id UUID;
    lock_safe_id UUID;
    lock_car_key_id UUID;
    lock_repair_id UUID;
    towing_id UUID;
BEGIN
    -- Get service IDs for aircon services
    SELECT id INTO aircon_regular_id FROM public.services WHERE name = 'Regular Cleaning';
    SELECT id INTO aircon_deep_id FROM public.services WHERE name = 'Deep Cleaning';
    SELECT id INTO aircon_repair_id FROM public.services WHERE name = 'AC Repair';
    SELECT id INTO aircon_parts_id FROM public.services WHERE name = 'Parts Replacement';

    -- Get service IDs for locksmith services
    SELECT id INTO lock_car_door_id FROM public.services WHERE name = 'Car door lockout';
    SELECT id INTO lock_key_dup_id FROM public.services WHERE name = 'Key Duplication';
    SELECT id INTO lock_safe_id FROM public.services WHERE name = 'Safe/Vault Opening';
    SELECT id INTO lock_car_key_id FROM public.services WHERE name = 'Car key duplication';
    SELECT id INTO lock_repair_id FROM public.services WHERE name = 'Lock repair / Re-keying';

    -- Get service ID for towing
    SELECT id INTO towing_id FROM public.services WHERE name = 'Towing';

    -- =====================================================
    -- AIRCON REGULAR CLEANING - Populate properties
    -- =====================================================
    IF aircon_regular_id IS NOT NULL THEN
        -- Split Type variants
        UPDATE public.service_variants SET properties = '{"type": "split", "hp": 1}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Split Type - 1HP';

        UPDATE public.service_variants SET properties = '{"type": "split", "hp": 1.5}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Split Type - 1.5HP';

        UPDATE public.service_variants SET properties = '{"type": "split", "hp": 2}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Split Type - 2HP';

        UPDATE public.service_variants SET properties = '{"type": "split", "hp": 3}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Split Type - 3HP';

        -- Window Non-Inverter variants
        UPDATE public.service_variants SET properties = '{"type": "window", "inverter": false, "hp": 1}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Window (Non-Inv) - 1HP';

        UPDATE public.service_variants SET properties = '{"type": "window", "inverter": false, "hp": 1.5}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Window (Non-Inv) - 1.5HP';

        UPDATE public.service_variants SET properties = '{"type": "window", "inverter": false, "hp": 2}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Window (Non-Inv) - 2HP+';

        -- Window Inverter
        UPDATE public.service_variants SET properties = '{"type": "window", "inverter": true}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Window (Inverter) - Any';

        -- Floor Mounted & Cassette
        UPDATE public.service_variants SET properties = '{"type": "floor_mounted"}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Floor Mounted';

        UPDATE public.service_variants SET properties = '{"type": "cassette"}'::JSONB
        WHERE service_id = aircon_regular_id AND name = 'Cassette Type';

        -- Set variant_selection_schema for Regular Cleaning
        UPDATE public.services SET variant_selection_schema = '{
            "selectors": [
                {
                    "key": "type",
                    "label": "Unit Type",
                    "type": "select",
                    "options": [
                        {"value": "split", "label": "Split Type"},
                        {"value": "window", "label": "Window Type"},
                        {"value": "floor_mounted", "label": "Floor Mounted"},
                        {"value": "cassette", "label": "Cassette Type"}
                    ]
                },
                {
                    "key": "hp",
                    "label": "Horsepower",
                    "type": "select",
                    "dependsOn": {"type": ["split"]},
                    "options": [
                        {"value": 1, "label": "1HP"},
                        {"value": 1.5, "label": "1.5HP"},
                        {"value": 2, "label": "2HP"},
                        {"value": 3, "label": "3HP"}
                    ]
                },
                {
                    "key": "inverter",
                    "label": "Inverter Type",
                    "type": "select",
                    "dependsOn": {"type": ["window"]},
                    "options": [
                        {"value": false, "label": "Non-Inverter"},
                        {"value": true, "label": "Inverter"}
                    ]
                },
                {
                    "key": "hp",
                    "label": "Horsepower",
                    "type": "select",
                    "dependsOn": {"type": ["window"], "inverter": [false]},
                    "options": [
                        {"value": 1, "label": "1HP"},
                        {"value": 1.5, "label": "1.5HP"},
                        {"value": 2, "label": "2HP+"}
                    ]
                }
            ]
        }'::JSONB
        WHERE id = aircon_regular_id;
    END IF;

    -- =====================================================
    -- AIRCON DEEP CLEANING - Populate properties
    -- =====================================================
    IF aircon_deep_id IS NOT NULL THEN
        UPDATE public.service_variants SET properties = '{"type": "split", "hp_range": "1-1.5"}'::JSONB
        WHERE service_id = aircon_deep_id AND name = 'Split Type - 1HP/1.5HP';

        UPDATE public.service_variants SET properties = '{"type": "split", "hp_range": "2-3"}'::JSONB
        WHERE service_id = aircon_deep_id AND name = 'Split Type - 2HP/3HP';

        UPDATE public.service_variants SET properties = '{"type": "window", "inverter": false, "hp_range": "1-1.5"}'::JSONB
        WHERE service_id = aircon_deep_id AND name = 'Window (Non-Inv) - 1HP/1.5HP';

        UPDATE public.service_variants SET properties = '{"type": "window", "inverter": false, "hp_range": "2-3"}'::JSONB
        WHERE service_id = aircon_deep_id AND name = 'Window (Non-Inv) - 2HP/3HP';

        UPDATE public.service_variants SET properties = '{"type": "window", "inverter": true}'::JSONB
        WHERE service_id = aircon_deep_id AND name = 'Window (Inverter) - Any';

        -- Set variant_selection_schema for Deep Cleaning
        UPDATE public.services SET variant_selection_schema = '{
            "selectors": [
                {
                    "key": "type",
                    "label": "Unit Type",
                    "type": "select",
                    "options": [
                        {"value": "split", "label": "Split Type"},
                        {"value": "window", "label": "Window Type"}
                    ]
                },
                {
                    "key": "hp_range",
                    "label": "Horsepower Range",
                    "type": "select",
                    "dependsOn": {"type": ["split"]},
                    "options": [
                        {"value": "1-1.5", "label": "1HP - 1.5HP"},
                        {"value": "2-3", "label": "2HP - 3HP"}
                    ]
                },
                {
                    "key": "inverter",
                    "label": "Inverter Type",
                    "type": "select",
                    "dependsOn": {"type": ["window"]},
                    "options": [
                        {"value": false, "label": "Non-Inverter"},
                        {"value": true, "label": "Inverter"}
                    ]
                },
                {
                    "key": "hp_range",
                    "label": "Horsepower Range",
                    "type": "select",
                    "dependsOn": {"type": ["window"], "inverter": [false]},
                    "options": [
                        {"value": "1-1.5", "label": "1HP - 1.5HP"},
                        {"value": "2-3", "label": "2HP - 3HP"}
                    ]
                }
            ]
        }'::JSONB
        WHERE id = aircon_deep_id;
    END IF;

    -- =====================================================
    -- AIRCON PARTS REPLACEMENT - Populate properties
    -- =====================================================
    IF aircon_parts_id IS NOT NULL THEN
        UPDATE public.service_variants SET properties = '{"type": "window", "part": "capacitor"}'::JSONB
        WHERE service_id = aircon_parts_id AND name = 'Window Type - Capacitor';

        UPDATE public.service_variants SET properties = '{"type": "window", "part": "fan_motor"}'::JSONB
        WHERE service_id = aircon_parts_id AND name = 'Window Type - Fan Motor';

        UPDATE public.service_variants SET properties = '{"type": "split", "part": "capacitor"}'::JSONB
        WHERE service_id = aircon_parts_id AND name = 'Split Type - Capacitor';

        UPDATE public.service_variants SET properties = '{"type": "split", "part": "fan_motor"}'::JSONB
        WHERE service_id = aircon_parts_id AND name = 'Split Type - Fan Motor';

        -- Set variant_selection_schema for Parts Replacement
        UPDATE public.services SET variant_selection_schema = '{
            "selectors": [
                {
                    "key": "type",
                    "label": "Unit Type",
                    "type": "select",
                    "options": [
                        {"value": "split", "label": "Split Type"},
                        {"value": "window", "label": "Window Type"}
                    ]
                },
                {
                    "key": "part",
                    "label": "Part to Replace",
                    "type": "select",
                    "options": [
                        {"value": "capacitor", "label": "Capacitor"},
                        {"value": "fan_motor", "label": "Fan Motor"}
                    ]
                }
            ]
        }'::JSONB
        WHERE id = aircon_parts_id;
    END IF;

    -- =====================================================
    -- LOCKSMITH - Car door lockout
    -- =====================================================
    IF lock_car_door_id IS NOT NULL THEN
        UPDATE public.service_variants SET properties = '{"tier": "standard"}'::JSONB
        WHERE service_id = lock_car_door_id AND name = 'Standard';

        UPDATE public.service_variants SET properties = '{"tier": "luxury"}'::JSONB
        WHERE service_id = lock_car_door_id AND name = 'Luxury';

        UPDATE public.services SET variant_selection_schema = '{
            "selectors": [
                {
                    "key": "tier",
                    "label": "Vehicle Type",
                    "type": "select",
                    "options": [
                        {"value": "standard", "label": "Standard Vehicle"},
                        {"value": "luxury", "label": "Luxury/Premium Vehicle"}
                    ]
                }
            ]
        }'::JSONB
        WHERE id = lock_car_door_id;
    END IF;

    -- =====================================================
    -- LOCKSMITH - Key Duplication
    -- =====================================================
    IF lock_key_dup_id IS NOT NULL THEN
        UPDATE public.service_variants SET properties = '{"key_type": "standard"}'::JSONB
        WHERE service_id = lock_key_dup_id AND name = 'Standard';

        UPDATE public.service_variants SET properties = '{"key_type": "high_security"}'::JSONB
        WHERE service_id = lock_key_dup_id AND name = 'High Security';

        UPDATE public.service_variants SET properties = '{"key_type": "dimple"}'::JSONB
        WHERE service_id = lock_key_dup_id AND name = 'Dimple Key';

        UPDATE public.service_variants SET properties = '{"key_type": "laser_cut"}'::JSONB
        WHERE service_id = lock_key_dup_id AND name = 'Laser Cut';

        UPDATE public.services SET variant_selection_schema = '{
            "selectors": [
                {
                    "key": "key_type",
                    "label": "Key Type",
                    "type": "select",
                    "options": [
                        {"value": "standard", "label": "Standard Key"},
                        {"value": "high_security", "label": "High Security Key"},
                        {"value": "dimple", "label": "Dimple Key"},
                        {"value": "laser_cut", "label": "Laser Cut Key"}
                    ]
                }
            ]
        }'::JSONB
        WHERE id = lock_key_dup_id;
    END IF;

    -- =====================================================
    -- LOCKSMITH - Safe/Vault Opening
    -- =====================================================
    IF lock_safe_id IS NOT NULL THEN
        UPDATE public.service_variants SET properties = '{"safe_type": "mechanical"}'::JSONB
        WHERE service_id = lock_safe_id AND name = 'Mechanical';

        UPDATE public.service_variants SET properties = '{"safe_type": "digital"}'::JSONB
        WHERE service_id = lock_safe_id AND name = 'Digital';

        UPDATE public.services SET variant_selection_schema = '{
            "selectors": [
                {
                    "key": "safe_type",
                    "label": "Safe Type",
                    "type": "select",
                    "options": [
                        {"value": "mechanical", "label": "Mechanical Safe"},
                        {"value": "digital", "label": "Digital Safe"}
                    ]
                }
            ]
        }'::JSONB
        WHERE id = lock_safe_id;
    END IF;

    -- =====================================================
    -- LOCKSMITH - Car key duplication
    -- =====================================================
    IF lock_car_key_id IS NOT NULL THEN
        UPDATE public.service_variants SET properties = '{"key_type": "standard"}'::JSONB
        WHERE service_id = lock_car_key_id AND name = 'Standard';

        UPDATE public.service_variants SET properties = '{"key_type": "keyfob"}'::JSONB
        WHERE service_id = lock_car_key_id AND name = 'Keyfob';

        UPDATE public.services SET variant_selection_schema = '{
            "selectors": [
                {
                    "key": "key_type",
                    "label": "Key Type",
                    "type": "select",
                    "options": [
                        {"value": "standard", "label": "Standard Car Key"},
                        {"value": "keyfob", "label": "Key Fob / Smart Key"}
                    ]
                }
            ]
        }'::JSONB
        WHERE id = lock_car_key_id;
    END IF;

    -- =====================================================
    -- LOCKSMITH - Lock repair / Re-keying
    -- =====================================================
    IF lock_repair_id IS NOT NULL THEN
        UPDATE public.service_variants SET properties = '{"lock_type": "standard"}'::JSONB
        WHERE service_id = lock_repair_id AND name = 'Standard';

        UPDATE public.service_variants SET properties = '{"lock_type": "dimple"}'::JSONB
        WHERE service_id = lock_repair_id AND name = 'Dimple Key';

        UPDATE public.services SET variant_selection_schema = '{
            "selectors": [
                {
                    "key": "lock_type",
                    "label": "Lock Type",
                    "type": "select",
                    "options": [
                        {"value": "standard", "label": "Standard Lock"},
                        {"value": "dimple", "label": "Dimple Key Lock"}
                    ]
                }
            ]
        }'::JSONB
        WHERE id = lock_repair_id;
    END IF;

    -- =====================================================
    -- AUTOMOTIVE - Towing
    -- =====================================================
    IF towing_id IS NOT NULL THEN
        UPDATE public.service_variants SET properties = '{"tow_type": "standard"}'::JSONB
        WHERE service_id = towing_id AND name = 'Standard';

        UPDATE public.service_variants SET properties = '{"tow_type": "luxury"}'::JSONB
        WHERE service_id = towing_id AND name = 'Luxury / Flatbed';

        UPDATE public.service_variants SET properties = '{"tow_type": "parking"}'::JSONB
        WHERE service_id = towing_id AND name = 'Parking Retrieval';

        UPDATE public.services SET variant_selection_schema = '{
            "selectors": [
                {
                    "key": "tow_type",
                    "label": "Service Type",
                    "type": "select",
                    "options": [
                        {"value": "standard", "label": "Standard Towing"},
                        {"value": "luxury", "label": "Luxury / Flatbed"},
                        {"value": "parking", "label": "Parking Retrieval"}
                    ]
                }
            ]
        }'::JSONB
        WHERE id = towing_id;
    END IF;

END $$;
