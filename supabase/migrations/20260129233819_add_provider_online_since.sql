-- Add online_since column to track when provider went online
ALTER TABLE public.providers
ADD COLUMN online_since TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.providers.online_since IS 'Timestamp when provider last went online. NULL when offline.';

-- Create trigger function to automatically set online_since when status changes
CREATE OR REPLACE FUNCTION public.update_provider_online_since()
RETURNS TRIGGER AS $$
BEGIN
    -- When status changes TO 'online', set online_since to current timestamp
    IF NEW.status = 'online' AND (OLD.status IS NULL OR OLD.status != 'online') THEN
        NEW.online_since = NOW();
    -- When status changes FROM 'online' to anything else, clear online_since
    ELSIF OLD.status = 'online' AND NEW.status != 'online' THEN
        NEW.online_since = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_provider_online_since ON public.providers;
CREATE TRIGGER trigger_update_provider_online_since
    BEFORE UPDATE ON public.providers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_provider_online_since();

-- Enable realtime for providers table (required for status change subscriptions)
-- Check if already in publication first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'providers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.providers;
    END IF;
END
$$;

-- Enable REPLICA IDENTITY FULL for providers (required for UPDATE events with old values)
ALTER TABLE public.providers REPLICA IDENTITY FULL;

-- Update existing online providers to have an online_since value (use updated_at as fallback)
UPDATE public.providers
SET online_since = COALESCE(updated_at, NOW())
WHERE status = 'online' AND online_since IS NULL;
