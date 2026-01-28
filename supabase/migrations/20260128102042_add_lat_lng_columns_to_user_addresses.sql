-- Add latitude and longitude columns to user_addresses table
-- This fixes the issue where geography(Point,4326) returns WKB hex format
-- which cannot be parsed on the client side

-- Add latitude and longitude columns (nullable initially)
ALTER TABLE user_addresses
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

-- Populate from existing geography data
UPDATE user_addresses
SET
  latitude = ST_Y(location::geometry),
  longitude = ST_X(location::geometry)
WHERE location IS NOT NULL;

-- Make columns NOT NULL after populating (with defaults for any NULL cases)
UPDATE user_addresses
SET latitude = 0, longitude = 0
WHERE latitude IS NULL OR longitude IS NULL;

ALTER TABLE user_addresses
ALTER COLUMN latitude SET NOT NULL,
ALTER COLUMN longitude SET NOT NULL;

-- Add check constraints for valid coordinates
ALTER TABLE user_addresses
ADD CONSTRAINT valid_latitude CHECK (latitude >= -90 AND latitude <= 90),
ADD CONSTRAINT valid_longitude CHECK (longitude >= -180 AND longitude <= 180);

-- Create index for efficient coordinate queries
CREATE INDEX idx_user_addresses_lat_lng ON user_addresses (latitude, longitude);
