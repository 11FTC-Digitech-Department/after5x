-- Add latitude and longitude columns to booking_gps_logs table
-- This fixes the issue where geography(Point,4326) returns WKB hex format
-- which cannot be parsed on the client side via Supabase realtime

-- Add latitude and longitude columns (nullable initially)
ALTER TABLE booking_gps_logs
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

-- Populate from existing geography data
UPDATE booking_gps_logs
SET
  latitude = ST_Y(location::geometry),
  longitude = ST_X(location::geometry)
WHERE location IS NOT NULL;

-- Set defaults for any NULL cases (shouldn't happen but safety measure)
UPDATE booking_gps_logs
SET latitude = 0, longitude = 0
WHERE latitude IS NULL OR longitude IS NULL;

-- Make columns NOT NULL after populating
ALTER TABLE booking_gps_logs
ALTER COLUMN latitude SET NOT NULL,
ALTER COLUMN longitude SET NOT NULL;

-- Add check constraints for valid coordinates
ALTER TABLE booking_gps_logs
ADD CONSTRAINT valid_gps_latitude CHECK (latitude >= -90 AND latitude <= 90),
ADD CONSTRAINT valid_gps_longitude CHECK (longitude >= -180 AND longitude <= 180);

-- Create index for efficient coordinate queries
CREATE INDEX idx_booking_gps_logs_lat_lng ON booking_gps_logs (latitude, longitude);
