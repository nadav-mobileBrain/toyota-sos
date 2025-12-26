-- Update vehicle license plates to have valid formats (7 or 8 digits)
-- This migration updates existing license plates that don't have 7 or 8 digits
-- to random valid license plates (temporary until real data is entered)

-- Function to generate random license plate with 7 or 8 digits
CREATE OR REPLACE FUNCTION generate_random_license_plate()
RETURNS TEXT AS $$
DECLARE
  digit_count INT;
  random_plate TEXT := '';
  i INT;
BEGIN
  -- Randomly choose 7 or 8 digits (50% chance each)
  digit_count := CASE WHEN random() < 0.5 THEN 7 ELSE 8 END;
  
  -- Generate random digits
  FOR i IN 1..digit_count LOOP
    random_plate := random_plate || floor(random() * 10)::TEXT;
  END LOOP;
  
  RETURN random_plate;
END;
$$ LANGUAGE plpgsql;

-- Update vehicles that don't have 7 or 8 digits
UPDATE public.vehicles
SET license_plate = generate_random_license_plate()
WHERE LENGTH(REGEXP_REPLACE(license_plate, '[^0-9]', '', 'g')) NOT IN (7, 8);

-- Drop the temporary function
DROP FUNCTION IF EXISTS generate_random_license_plate();

-- Note: After running this migration, you should review and update the license plates
-- with real data as these are randomly generated temporary values.

