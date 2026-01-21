-- Add properties column to service_variants for structured variant data
ALTER TABLE public.service_variants
ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT '{}'::JSONB;

-- Add variant_selection_schema to services for defining selector configuration
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS variant_selection_schema JSONB DEFAULT NULL;

-- Add image_url column to services if not exists
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index for efficient property querying
CREATE INDEX IF NOT EXISTS idx_service_variants_properties
ON public.service_variants USING GIN (properties);

-- Add comment for documentation
COMMENT ON COLUMN public.service_variants.properties IS 'Structured properties for variant selection (e.g., {type: "split", hp: 1.5})';
COMMENT ON COLUMN public.services.variant_selection_schema IS 'JSON schema defining how variants should be selected via dropdowns';
