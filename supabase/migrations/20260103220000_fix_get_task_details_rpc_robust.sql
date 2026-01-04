-- Fix get_task_details logic to be more robust
-- Allow access if EITHER auth.uid() matches OR p_driver_id matches
-- removing the "auth.uid() IS NULL" constraint from the fallback path.

CREATE OR REPLACE FUNCTION public.get_task_details(
  task_id uuid,
  p_driver_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  type public.task_type,
  priority public.task_priority,
  status public.task_status,
  details text,
  estimated_start timestamptz,
  estimated_end timestamptz,
  address text,
  client_name text,
  vehicle_plate text,
  vehicle_model text,
  client_vehicle_plate text,
  client_vehicle_model text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.type,
    t.priority,
    t.status,
    t.details,
    t.estimated_start,
    t.estimated_end,
    t.address,
    c.name AS client_name,
    v.license_plate AS vehicle_plate,
    v.model AS vehicle_model,
    cv.license_plate AS client_vehicle_plate,
    cv.model AS client_vehicle_model,
    t.updated_at
  from public.tasks t
  LEFT JOIN public.clients c ON c.id = t.client_id
  LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
  LEFT JOIN public.clients_vehicles cv ON cv.id = t.client_vehicle_id
  WHERE t.id = get_task_details.task_id
  AND (
    -- 1. Authenticated user check
    (auth.uid() IS NOT NULL AND (
      -- Is assigned driver
      EXISTS (
        SELECT 1 FROM public.task_assignees ta
        WHERE ta.task_id = t.id AND ta.driver_id = auth.uid()
      )
      OR
      -- Is staff (admin/manager/viewer)
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'viewer')
      )
    ))
    OR
    -- 2. Explicit driver_id check (fallback for hybrid auth or partial sessions)
    (p_driver_id IS NOT NULL AND (
       EXISTS (
         SELECT 1 FROM public.task_assignees ta
         WHERE ta.task_id = t.id AND ta.driver_id = p_driver_id
       )
    ))
  )
  LIMIT 1;
$$;
