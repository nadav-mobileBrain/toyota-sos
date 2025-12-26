-- Add availability fields to vehicles table
-- These fields allow marking vehicles as unavailable with a reason

ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS unavailability_reason TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.vehicles.is_available IS 'Indicates if the vehicle is currently available for assignment to tasks';
COMMENT ON COLUMN public.vehicles.unavailability_reason IS 'Reason why the vehicle is unavailable (e.g., maintenance, not at dealership)';

-- Create index for faster filtering of available vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_is_available ON public.vehicles(is_available) WHERE is_available = true;

