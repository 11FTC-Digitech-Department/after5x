-- Add the new locksmithing service variants to Masterlock provider
DO $$
DECLARE
    masterlock_provider_id UUID;
BEGIN
    -- Find the Masterlock provider by agency name
    SELECT p.id INTO masterlock_provider_id
    FROM public.providers p
    JOIN public.agencies a ON p.agency_id = a.id
    WHERE a.name = 'Masterlock PH'
    LIMIT 1;

    -- If provider exists, add the offerings
    IF masterlock_provider_id IS NOT NULL THEN
        -- Add the new locksmithing service variants to Masterlock provider
        INSERT INTO public.provider_offerings (provider_id, service_variant_id)
        SELECT masterlock_provider_id, sv.id
        FROM public.service_variants sv
        JOIN public.services s ON s.id = sv.service_id
        JOIN public.service_categories sc ON sc.id = s.category_id
        WHERE sc.slug = 'locksmithing'
          AND sv.is_active = true
          AND s.is_active = true
          AND sc.is_active = true
          AND sv.name IN ('Standard') -- Only add the Standard variants for new services
          AND s.name IN ('Key extraction', 'Smart key', 'Vault servicing and maintenance', 'Digital Safe Combination reset / Code retrieval')
        ON CONFLICT DO NOTHING;

        -- Add the customized key variant to existing offerings
        INSERT INTO public.provider_offerings (provider_id, service_variant_id)
        SELECT masterlock_provider_id, sv.id
        FROM public.service_variants sv
        JOIN public.services s ON s.id = sv.service_id
        WHERE s.name = 'Key Duplication'
          AND sv.name = 'Customized Key'
          AND sv.is_active = true
        ON CONFLICT DO NOTHING;
    END IF;
END $$;