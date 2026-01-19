-- Add the new locksmithing service variants to Masterlock provider
INSERT INTO public.provider_offerings (provider_id, service_variant_id)
SELECT '7552f6cf-59ef-4d18-be6f-8e6fca46bf98', sv.id
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
SELECT '7552f6cf-59ef-4d18-be6f-8e6fca46bf98', sv.id
FROM public.service_variants sv
JOIN public.services s ON s.id = sv.service_id
WHERE s.name = 'Key Duplication'
  AND sv.name = 'Customized Key'
  AND sv.is_active = true
ON CONFLICT DO NOTHING;