-- Fix RLS policies for driver_breaks to allow realtime subscriptions
-- RLS can block realtime events even if SELECT is granted

-- First, check if we need to enable RLS (it might already be enabled)
-- If RLS is off, we don't need policies at all

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins and managers can see all breaks" ON public.driver_breaks;
DROP POLICY IF EXISTS "Drivers can see own breaks" ON public.driver_breaks;

-- Recreate policies with proper permissions for realtime
CREATE POLICY "Admins and managers can see all breaks"
ON public.driver_breaks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'manager', 'viewer')
  )
);

CREATE POLICY "Drivers can see own breaks"
ON public.driver_breaks
FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'driver'
  )
);

-- Grant ALL permissions to service_role (for API operations)
GRANT ALL ON public.driver_breaks TO service_role;

-- Make sure RLS is enabled
ALTER TABLE public.driver_breaks ENABLE ROW LEVEL SECURITY;

-- Add a comment for documentation
COMMENT ON TABLE public.driver_breaks IS 
'Tracks driver break periods. RLS policies allow admins/managers to see all breaks and drivers to see their own.';

