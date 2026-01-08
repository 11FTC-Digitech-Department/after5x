-- ================================================================
-- AFTER5 SEED DATA
-- Combined Catalog, Auth Users, and Provider Population
-- ================================================================

-- DEFINE HELPER FUNCTION FIRST (Standalone, not in DO block)
CREATE OR REPLACE FUNCTION public.create_seed_user(user_id UUID, user_email TEXT, user_full_name TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (user_id, '00000000-0000-0000-0000-000000000000', user_email, crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', user_full_name), NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING; 
END;
$$ LANGUAGE plpgsql;

-- PART 1: SERVICE CATALOG
DO $$
DECLARE
    cat_lock UUID; cat_aircon UUID; cat_elec UUID; cat_auto UUID; cat_plumb UUID;
    current_service_id UUID;
    form_locksmith JSONB := '[{"key": "situation", "type": "textarea", "label": "Describe the lock issue", "required": true}, {"key": "proof_ownership", "type": "checkbox", "label": "I can provide proof of ownership", "required": true}]';
    form_aircon JSONB := '[{"key": "brand", "type": "text", "label": "Unit Brand", "required": true}, {"key": "last_cleaned", "type": "select", "label": "Last Cleaning", "options": ["< 6 months", "6-12 months", "> 1 year"], "required": true}]';
    form_elec JSONB := '[{"key": "issue_desc", "type": "textarea", "label": "Describe the electrical issue", "required": true}, {"key": "safety_check", "type": "checkbox", "label": "Is there a burning smell or sparks?", "required": true}]';
    form_auto JSONB := '[{"key": "car_model", "type": "text", "label": "Car Make & Model", "required": true}, {"key": "location_type", "type": "select", "label": "Location", "options": ["Home", "Roadside (Safe)", "Roadside (Highway)"], "required": true}]';
    form_plumb JSONB := '[{"key": "leak_location", "type": "text", "label": "Location of Leak/Clog", "required": true}, {"key": "severity", "type": "select", "label": "Severity", "options": ["Drip", "Flow", "Flooding"], "required": true}]';
BEGIN
    INSERT INTO public.service_categories (name, slug, icon_url, sort_order) VALUES ('Locksmithing', 'locksmithing', 'assets/icon/locksmith.png', 1) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO cat_lock;
    IF cat_lock IS NULL THEN SELECT id INTO cat_lock FROM public.service_categories WHERE slug = 'locksmithing'; END IF;
    INSERT INTO public.service_categories (name, slug, icon_url, sort_order) VALUES ('Aircon', 'aircon', 'assets/icon/ac.png', 2) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO cat_aircon;
    IF cat_aircon IS NULL THEN SELECT id INTO cat_aircon FROM public.service_categories WHERE slug = 'aircon'; END IF;
    INSERT INTO public.service_categories (name, slug, icon_url, sort_order) VALUES ('Electrical', 'electrical', 'assets/icon/electrical.png', 3) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO cat_elec;
    IF cat_elec IS NULL THEN SELECT id INTO cat_elec FROM public.service_categories WHERE slug = 'electrical'; END IF;
    INSERT INTO public.service_categories (name, slug, icon_url, sort_order) VALUES ('Automotive', 'automotive', 'assets/icon/automotive.png', 4) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO cat_auto;
    IF cat_auto IS NULL THEN SELECT id INTO cat_auto FROM public.service_categories WHERE slug = 'automotive'; END IF;
    INSERT INTO public.service_categories (name, slug, icon_url, sort_order) VALUES ('Plumbing', 'plumbing', 'assets/icon/plumbing.png', 5) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO cat_plumb;
    IF cat_plumb IS NULL THEN SELECT id INTO cat_plumb FROM public.service_categories WHERE slug = 'plumbing'; END IF;

    -- LOCKSMITH
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Home lockout assistance') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Home lockout assistance', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 800.00, 1500.00, 1360.00, 2550.00);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Lock installation') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Lock installation', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 750.00, 1200.00, 1275.00, 2040.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Smart lock installation') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Smart lock installation', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 2500.00, 2500.00, 4250.00, 4250.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Lock repair / Re-keying') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Lock repair / Re-keying', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 950.00, 1500.00, 1615.00, 2550.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Dimple Key', 1950.00, 1950.00, 3315.00, 3315.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Smart lock setup and programming') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Smart lock setup and programming', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 1500.00, 3000.00, 2550.00, 5100.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Glass door unlocking') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Glass door unlocking', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 1250.00, 1250.00, 2125.00, 2125.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Car door lockout') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Car door lockout', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 1250.00, 1950.00, 2125.00, 3315.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Luxury', 2500.00, 3000.00, 4250.00, 5100.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Car key duplication') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Car key duplication', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 700.00, 1200.00, 1190.00, 2040.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Keyfob', 2500.00, 4500.00, 4250.00, 7650.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Safe/Vault Opening') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Safe/Vault Opening', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Mechanical', 2500.00, 5000.00, 4250.00, 8500.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Digital', 3000.00, 6000.00, 5100.00, 10200.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Key Duplication') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_lock, 'Key Duplication', form_locksmith) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 150.00, 150.00, 255.00, 255.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'High Security', 500.00, 500.00, 850.00, 850.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Dimple Key', 850.00, 850.00, 1445.00, 1445.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Laser Cut', 950.00, 950.00, 1615.00, 1615.00);
    END IF;

    -- AIRCON
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Regular Cleaning') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_aircon, 'Regular Cleaning', form_aircon) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Split Type - 1HP', 1200.00, 1200.00, 2040.00, 2040.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Split Type - 1.5HP', 1200.00, 1200.00, 2040.00, 2040.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Split Type - 2HP', 1500.00, 1500.00, 2550.00, 2550.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Split Type - 3HP', 1500.00, 1500.00, 2550.00, 2550.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Window (Non-Inv) - 1HP', 500.00, 500.00, 850.00, 850.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Window (Non-Inv) - 1.5HP', 500.00, 500.00, 850.00, 850.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Window (Non-Inv) - 2HP+', 600.00, 600.00, 1020.00, 1020.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Window (Inverter) - Any', 700.00, 700.00, 1190.00, 1190.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Floor Mounted', 3000.00, 3000.00, 5100.00, 5100.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Cassette Type', 5500.00, 5500.00, 9350.00, 9350.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Deep Cleaning') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_aircon, 'Deep Cleaning', form_aircon) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Split Type - 1HP/1.5HP', 2400.00, 2400.00, 4080.00, 4080.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Split Type - 2HP/3HP', 3000.00, 3000.00, 5100.00, 5100.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Window (Non-Inv) - 1HP/1.5HP', 1000.00, 1000.00, 1700.00, 1700.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Window (Non-Inv) - 2HP/3HP', 1200.00, 1200.00, 2040.00, 2040.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Window (Inverter) - Any', 1400.00, 1400.00, 2380.00, 2380.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'AC Repair') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_aircon, 'AC Repair', form_aircon) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Ocular / Diagnostic', 500.00, 500.00, 800.00, 800.00);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Parts Replacement') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_aircon, 'Parts Replacement', form_aircon) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Window Type - Capacitor', 2500.00, 2500.00, 4250.00, 4250.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Window Type - Fan Motor', 2000.00, 2000.00, 3400.00, 3400.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Split Type - Capacitor', 3500.00, 3500.00, 5950.00, 5950.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Split Type - Fan Motor', 3000.00, 3000.00, 5100.00, 5100.00);
    END IF;

    -- ELECTRICAL
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Relamping') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_elec, 'Relamping', form_elec) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Per Bulb', 100.00, 100.00, 170.00, 170.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard Fixture', 250.00, 250.00, 425.00, 425.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Installation & Replacement') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_elec, 'Installation & Replacement', form_elec) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard Install', 250.00, 250.00, 425.00, 425.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Complex Install', 300.00, 300.00, 510.00, 510.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Repair / Fix', 200.00, 200.00, 340.00, 340.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Circuit Panel', 100.00, 100.00, 170.00, 170.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Circuit Breaker Main', 500.00, 500.00, 850.00, 850.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Panel Box Install', 1000.00, 1000.00, 1700.00, 1700.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Water Heater (Portable)', 2000.00, 2000.00, 3400.00, 3400.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Water Heater (Centralized)', 800.00, 800.00, 1360.00, 1360.00);
    END IF;

    -- AUTOMOTIVE
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Battery Jumpstart') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_auto, 'Battery Jumpstart', form_auto) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 1500.00, 1500.00, 2550.00, 2550.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Change of Flat Tire') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_auto, 'Change of Flat Tire', form_auto) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 1500.00, 1500.00, 2550.00, 2550.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Fuel Delivery') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_auto, 'Fuel Delivery', form_auto) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Service Fee (Fuel Cost Extra)', 1500.00, 1500.00, 2550.00, 2550.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Towing') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_auto, 'Towing', form_auto) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Standard', 3500.00, 3500.00, 5950.00, 5950.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Luxury / Flatbed', 7000.00, 7000.00, 11900.00, 11900.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Parking Retrieval', 3500.00, 3500.00, 5950.00, 5950.00);
    END IF;

    -- PLUMBING
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Declogging & Siphoning') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_plumb, 'Declogging & Siphoning', form_plumb) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Declogging', 1500.00, 1500.00, 2550.00, 2550.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Drain Line Cleaning', 2000.00, 2000.00, 3400.00, 3400.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Septic Tank Siphoning', 3500.00, 3500.00, 5950.00, 5950.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Sludge Removal', 7000.00, 7000.00, 11900.00, 11900.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Leak / Smoke Test') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_plumb, 'Leak / Smoke Test', form_plumb) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Leak Test', 1500.00, 1500.00, 2550.00, 2550.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Smoke Test', 1500.00, 1500.00, 2550.00, 2550.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Plumbing Repair') THEN
        INSERT INTO public.services (category_id, name, booking_form_schema) VALUES (cat_plumb, 'Plumbing Repair', form_plumb) RETURNING id INTO current_service_id;
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Sink Repair', 300.00, 300.00, 510.00, 510.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Faucet Repair', 150.00, 150.00, 255.00, 255.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Water Heater Install', 1500.00, 1500.00, 2550.00, 2550.00);
        INSERT INTO public.service_variants (service_id, name, price_min, price_max, price_after5_min, price_after5_max) VALUES (current_service_id, 'Pipe Leak Repair', 800.00, 5000.00, 1360.00, 8500.00);
    END IF;

END $$;

-- PART 2: AGENCIES & AUTH USERS
DO $$
DECLARE
    agency_teko UUID := gen_random_uuid(); agency_rgl UUID := gen_random_uuid();
    agency_meier UUID := gen_random_uuid(); agency_pame UUID := gen_random_uuid();
    agency_malabanan UUID := gen_random_uuid(); agency_kmace UUID := gen_random_uuid();
    agency_newgen UUID := gen_random_uuid(); agency_masterlock UUID := gen_random_uuid();
    
    tech_teko UUID := gen_random_uuid(); tech_rgl UUID := gen_random_uuid();
    tech_meier UUID := gen_random_uuid(); tech_pame UUID := gen_random_uuid();
    tech_malabanan UUID := gen_random_uuid(); tech_kmace UUID := gen_random_uuid();
    tech_newgen UUID := gen_random_uuid(); tech_masterlock UUID := gen_random_uuid();
    
    var_record RECORD;
BEGIN
    PERFORM public.create_seed_user(agency_teko, 'admin@teko.ph', 'Teko Admin');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (agency_teko, 'admin@teko.ph', 'Teko Admin', '09170000001', 'agency_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.agencies (id, owner_id, name, commission_rate, verification_status) VALUES (agency_teko, agency_teko, 'Teko PH', 15.00, 'verified') ON CONFLICT DO NOTHING;

    PERFORM public.create_seed_user(agency_rgl, 'admin@rgl.ph', 'RGL Admin');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (agency_rgl, 'admin@rgl.ph', 'RGL Admin', '09170000002', 'agency_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.agencies (id, owner_id, name, commission_rate, verification_status) VALUES (agency_rgl, agency_rgl, 'RGL Aircon Services', 10.00, 'verified') ON CONFLICT DO NOTHING;

    PERFORM public.create_seed_user(agency_meier, 'admin@meier.ph', 'MEIER Admin');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (agency_meier, 'admin@meier.ph', 'MEIER Admin', '09170000003', 'agency_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.agencies (id, owner_id, name, commission_rate, verification_status) VALUES (agency_meier, agency_meier, 'MEIER Multi-Services', 12.00, 'verified') ON CONFLICT DO NOTHING;

    PERFORM public.create_seed_user(agency_pame, 'admin@pame.ph', 'PAME Admin');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (agency_pame, 'admin@pame.ph', 'PAME Admin', '09170000004', 'agency_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.agencies (id, owner_id, name, commission_rate, verification_status) VALUES (agency_pame, agency_pame, 'PAME Inc.', 10.00, 'verified') ON CONFLICT DO NOTHING;

    PERFORM public.create_seed_user(agency_malabanan, 'admin@malabanan.ph', 'Malabanan Admin');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (agency_malabanan, 'admin@malabanan.ph', 'Malabanan Admin', '09170000005', 'agency_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.agencies (id, owner_id, name, commission_rate, verification_status) VALUES (agency_malabanan, agency_malabanan, 'One Malabanan', 15.00, 'verified') ON CONFLICT DO NOTHING;

    PERFORM public.create_seed_user(agency_kmace, 'admin@kmace.ph', 'KMAce Admin');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (agency_kmace, 'admin@kmace.ph', 'KMAce Admin', '09170000006', 'agency_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.agencies (id, owner_id, name, commission_rate, verification_status) VALUES (agency_kmace, agency_kmace, 'KMAce Auto', 10.00, 'verified') ON CONFLICT DO NOTHING;

    PERFORM public.create_seed_user(agency_newgen, 'admin@newgen.ph', 'NewGen Admin');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (agency_newgen, 'admin@newgen.ph', 'NewGen Admin', '09170000007', 'agency_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.agencies (id, owner_id, name, commission_rate, verification_status) VALUES (agency_newgen, agency_newgen, 'NewGen Towing & Auto', 10.00, 'verified') ON CONFLICT DO NOTHING;

    PERFORM public.create_seed_user(agency_masterlock, 'admin@masterlock.ph', 'Masterlock Admin');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (agency_masterlock, 'admin@masterlock.ph', 'Masterlock Admin', '09170000008', 'agency_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.agencies (id, owner_id, name, commission_rate, verification_status) VALUES (agency_masterlock, agency_masterlock, 'Masterlock PH', 15.00, 'verified') ON CONFLICT DO NOTHING;

    -- TECHNICIANS
    PERFORM public.create_seed_user(tech_teko, 'tech@teko.ph', 'Teko Specialist - Mark');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (tech_teko, 'tech@teko.ph', 'Teko Specialist - Mark', '09171110001', 'provider') ON CONFLICT DO NOTHING;
    INSERT INTO public.providers (id, agency_id, bio, status, current_location, verification_status) VALUES (tech_teko, agency_teko, 'Certified Aircon & Electrical Technician from Teko.', 'online', ST_SetSRID(ST_MakePoint(121.05, 14.55), 4326), 'verified') ON CONFLICT DO NOTHING;
    FOR var_record IN SELECT id FROM public.service_variants WHERE service_id IN (SELECT id FROM public.services WHERE category_id IN (SELECT id FROM public.service_categories WHERE slug IN ('aircon', 'electrical'))) LOOP
        INSERT INTO public.provider_offerings (provider_id, service_variant_id) VALUES (tech_teko, var_record.id) ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM public.create_seed_user(tech_rgl, 'tech@rgl.ph', 'RGL Specialist - John');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (tech_rgl, 'tech@rgl.ph', 'RGL Specialist - John', '09171110002', 'provider') ON CONFLICT DO NOTHING;
    INSERT INTO public.providers (id, agency_id, bio, status, current_location, verification_status) VALUES (tech_rgl, agency_rgl, 'Expert in Split Type and Window ACs.', 'online', ST_SetSRID(ST_MakePoint(121.06, 14.56), 4326), 'verified') ON CONFLICT DO NOTHING;
    FOR var_record IN SELECT id FROM public.service_variants WHERE service_id IN (SELECT id FROM public.services WHERE category_id IN (SELECT id FROM public.service_categories WHERE slug = 'aircon')) LOOP
        INSERT INTO public.provider_offerings (provider_id, service_variant_id) VALUES (tech_rgl, var_record.id) ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM public.create_seed_user(tech_meier, 'tech@meier.ph', 'MEIER Multi-Skilled - Dave');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (tech_meier, 'tech@meier.ph', 'MEIER Multi-Skilled - Dave', '09171110003', 'provider') ON CONFLICT DO NOTHING;
    INSERT INTO public.providers (id, agency_id, bio, status, current_location, verification_status) VALUES (tech_meier, agency_meier, 'Versatile technician for Plumbing, AC, and Electrical.', 'online', ST_SetSRID(ST_MakePoint(121.04, 14.54), 4326), 'verified') ON CONFLICT DO NOTHING;
    FOR var_record IN SELECT id FROM public.service_variants WHERE service_id IN (SELECT id FROM public.services WHERE category_id IN (SELECT id FROM public.service_categories WHERE slug IN ('aircon', 'electrical', 'plumbing'))) LOOP
        INSERT INTO public.provider_offerings (provider_id, service_variant_id) VALUES (tech_meier, var_record.id) ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM public.create_seed_user(tech_pame, 'tech@pame.ph', 'PAME Electrician - Rey');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (tech_pame, 'tech@pame.ph', 'PAME Electrician - Rey', '09171110004', 'provider') ON CONFLICT DO NOTHING;
    INSERT INTO public.providers (id, agency_id, bio, status, current_location, verification_status) VALUES (tech_pame, agency_pame, 'Licensed Electrician. Safety first.', 'online', ST_SetSRID(ST_MakePoint(121.03, 14.53), 4326), 'verified') ON CONFLICT DO NOTHING;
    FOR var_record IN SELECT id FROM public.service_variants WHERE service_id IN (SELECT id FROM public.services WHERE category_id IN (SELECT id FROM public.service_categories WHERE slug = 'electrical')) LOOP
        INSERT INTO public.provider_offerings (provider_id, service_variant_id) VALUES (tech_pame, var_record.id) ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM public.create_seed_user(tech_malabanan, 'tech@malabanan.ph', 'Malabanan Plumber - Jun');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (tech_malabanan, 'tech@malabanan.ph', 'Malabanan Plumber - Jun', '09171110005', 'provider') ON CONFLICT DO NOTHING;
    INSERT INTO public.providers (id, agency_id, bio, status, current_location, verification_status) VALUES (tech_malabanan, agency_malabanan, 'The trusted name in siphoning and plumbing.', 'online', ST_SetSRID(ST_MakePoint(121.02, 14.52), 4326), 'verified') ON CONFLICT DO NOTHING;
    FOR var_record IN SELECT id FROM public.service_variants WHERE service_id IN (SELECT id FROM public.services WHERE category_id IN (SELECT id FROM public.service_categories WHERE slug = 'plumbing')) LOOP
        INSERT INTO public.provider_offerings (provider_id, service_variant_id) VALUES (tech_malabanan, var_record.id) ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM public.create_seed_user(tech_kmace, 'tech@kmace.ph', 'KMAce Mechanic - Bert');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (tech_kmace, 'tech@kmace.ph', 'KMAce Mechanic - Bert', '09171110006', 'provider') ON CONFLICT DO NOTHING;
    INSERT INTO public.providers (id, agency_id, bio, status, current_location, verification_status) VALUES (tech_kmace, agency_kmace, 'Automotive expert. Battery and Tires.', 'online', ST_SetSRID(ST_MakePoint(121.01, 14.51), 4326), 'verified') ON CONFLICT DO NOTHING;
    FOR var_record IN SELECT id FROM public.service_variants WHERE service_id IN (SELECT id FROM public.services WHERE category_id IN (SELECT id FROM public.service_categories WHERE slug = 'automotive')) LOOP
        INSERT INTO public.provider_offerings (provider_id, service_variant_id) VALUES (tech_kmace, var_record.id) ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM public.create_seed_user(tech_newgen, 'tech@newgen.ph', 'NewGen Towing - Mike');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (tech_newgen, 'tech@newgen.ph', 'NewGen Towing - Mike', '09171110007', 'provider') ON CONFLICT DO NOTHING;
    INSERT INTO public.providers (id, agency_id, bio, status, current_location, verification_status) VALUES (tech_newgen, agency_newgen, '24/7 Towing and Roadside Assistance.', 'online', ST_SetSRID(ST_MakePoint(121.00, 14.50), 4326), 'verified') ON CONFLICT DO NOTHING;
    FOR var_record IN SELECT id FROM public.service_variants WHERE service_id IN (SELECT id FROM public.services WHERE category_id IN (SELECT id FROM public.service_categories WHERE slug = 'automotive')) LOOP
        INSERT INTO public.provider_offerings (provider_id, service_variant_id) VALUES (tech_newgen, var_record.id) ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM public.create_seed_user(tech_masterlock, 'tech@masterlock.ph', 'Masterlock Pro - Alex');
    INSERT INTO public.profiles (id, email, full_name, phone_number, role) VALUES (tech_masterlock, 'tech@masterlock.ph', 'Masterlock Pro - Alex', '09171110008', 'provider') ON CONFLICT DO NOTHING;
    INSERT INTO public.providers (id, agency_id, bio, status, current_location, verification_status) VALUES (tech_masterlock, agency_masterlock, 'Professional Locksmith. Residential and Automotive.', 'online', ST_SetSRID(ST_MakePoint(120.99, 14.49), 4326), 'verified') ON CONFLICT DO NOTHING;
    FOR var_record IN SELECT id FROM public.service_variants WHERE service_id IN (SELECT id FROM public.services WHERE category_id IN (SELECT id FROM public.service_categories WHERE slug = 'locksmith')) LOOP
        INSERT INTO public.provider_offerings (provider_id, service_variant_id) VALUES (tech_masterlock, var_record.id) ON CONFLICT DO NOTHING;
    END LOOP;

END $$;