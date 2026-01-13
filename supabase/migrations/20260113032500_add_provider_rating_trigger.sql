-- Create a function to update provider ratings when reviews are added/updated/deleted
CREATE OR REPLACE FUNCTION update_provider_rating()
RETURNS TRIGGER AS $$
DECLARE
    target_provider_id UUID;
    avg_rating DECIMAL(3,2);
    rating_count INT;
BEGIN
    -- Determine the target provider (could be customer or provider being reviewed)
    -- For now, assume reviews are for providers (target_id is provider)
    target_provider_id := COALESCE(NEW.target_id, OLD.target_id);

    -- Calculate new average rating and count for the provider
    SELECT
        ROUND(AVG(rating)::numeric, 2)::decimal(3,2),
        COUNT(*)::int
    INTO avg_rating, rating_count
    FROM reviews
    WHERE target_id = target_provider_id
    AND is_public = true;

    -- Handle case where there are no reviews
    IF avg_rating IS NULL THEN
        avg_rating := 0.00;
        rating_count := 0;
    END IF;

    -- Update the provider's rating statistics
    UPDATE providers
    SET
        rating_avg = avg_rating,
        rating_count = rating_count,
        updated_at = NOW()
    WHERE id = target_provider_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update provider ratings
DROP TRIGGER IF EXISTS trigger_update_provider_rating ON reviews;
CREATE TRIGGER trigger_update_provider_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_rating();

-- Re-enable RLS on reviews table (if not already enabled)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Update existing providers' ratings based on current reviews
-- This ensures existing data is consistent
UPDATE providers
SET rating_avg = COALESCE((
    SELECT ROUND(AVG(r.rating)::numeric, 2)::decimal(3,2)
    FROM reviews r
    WHERE r.target_id = providers.id AND r.is_public = true
), 0.00),
rating_count = COALESCE((
    SELECT COUNT(*)
    FROM reviews r
    WHERE r.target_id = providers.id AND r.is_public = true
), 0)::int,
updated_at = NOW()
WHERE EXISTS (
    SELECT 1 FROM reviews r WHERE r.target_id = providers.id
);