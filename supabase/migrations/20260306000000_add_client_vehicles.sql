-- Migration to support client vehicles
-- 1. Create clients_vehicles table
CREATE TABLE IF NOT EXISTS public.clients_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    license_plate TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Add client_vehicle_id to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_vehicle_id UUID REFERENCES public.clients_vehicles(id) ON DELETE SET NULL;

-- 3. Enable RLS on clients_vehicles
ALTER TABLE public.clients_vehicles ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for clients_vehicles (mirroring clients table)
DROP POLICY IF EXISTS clients_vehicles_read_all ON public.clients_vehicles;
CREATE POLICY clients_vehicles_read_all
ON public.clients_vehicles FOR SELECT
USING (true);

DROP POLICY IF EXISTS clients_vehicles_write_admin ON public.clients_vehicles;
CREATE POLICY clients_vehicles_write_admin
ON public.clients_vehicles FOR ALL
USING (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role)
WITH CHECK (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role);

-- 5. Update get_task_details RPC function
DROP FUNCTION IF EXISTS public.get_task_details(uuid);

CREATE OR REPLACE FUNCTION public.get_task_details(task_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
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
AS $$
  SELECT
    t.id,
    t.title,
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
  FROM public.tasks t
  LEFT JOIN public.clients c ON c.id = t.client_id
  LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
  LEFT JOIN public.clients_vehicles cv ON cv.id = t.client_vehicle_id
  WHERE t.id = get_task_details.task_id
  LIMIT 1;
$$;

-- 6. Update get_driver_tasks RPC function
DROP FUNCTION IF EXISTS public.get_driver_tasks(text, integer, timestamptz, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_driver_tasks(
  p_tab text default 'today',
  p_limit integer default 10,
  p_cursor_start timestamptz default null,
  p_cursor_id uuid default null,
  p_driver_id uuid default null
)
RETURNS TABLE (
  id uuid,
  title text,
  type public.task_type,
  priority public.task_priority,
  status public.task_status,
  estimated_start timestamptz,
  estimated_end timestamptz,
  address text,
  client_name text,
  client_phone text,
  vehicle_license_plate text,
  vehicle_model text,
  client_vehicle_plate text,
  client_vehicle_model text,
  updated_at timestamptz,
  distance_from_garage numeric,
  advisor_name text,
  advisor_color public.advisor_color,
  is_lead_driver boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_now timestamptz := now();
  v_today_start timestamptz;
  v_today_end timestamptz;
BEGIN
  -- Get current driver's profile ID from auth context
  v_driver_id := auth.uid();

  IF v_driver_id IS NULL AND p_driver_id IS NOT NULL THEN
    v_driver_id := p_driver_id;
  END IF;

  IF v_driver_id IS NOT NULL THEN
    SELECT p.id INTO v_driver_id
    FROM public.profiles p
    WHERE p.id = v_driver_id
    AND p.role = 'driver'
    LIMIT 1;
  END IF;

  IF v_driver_id IS NULL THEN
    RETURN;
  END IF;

  v_today_start := date_trunc('day', v_now AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';
  v_today_end := v_today_start + interval '1 day' - interval '1 second';

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.type,
    t.priority,
    t.status,
    t.estimated_start,
    t.estimated_end,
    t.address,
    c.name AS client_name,
    c.phone AS client_phone,
    v.license_plate AS vehicle_license_plate,
    v.model AS vehicle_model,
    cv.license_plate AS client_vehicle_plate,
    cv.model AS client_vehicle_model,
    t.updated_at,
    t.distance_from_garage,
    t.advisor_name,
    t.advisor_color,
    ta.is_lead AS is_lead_driver
  FROM public.tasks t
  INNER JOIN public.task_assignees ta ON ta.task_id = t.id
  LEFT JOIN public.clients c ON c.id = t.client_id
  LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
  LEFT JOIN public.clients_vehicles cv ON cv.id = t.client_vehicle_id
  WHERE ta.driver_id = v_driver_id
  AND t.deleted_at IS NULL
  AND (
    CASE p_tab
      WHEN 'today' THEN
        (t.estimated_end >= v_today_start AND t.estimated_end <= v_today_end)
        OR (t.estimated_start >= v_today_start AND t.estimated_start <= v_today_end)
        OR (t.status::text = 'בעבודה' AND t.estimated_end >= v_today_start)
      WHEN 'overdue' THEN
        t.status::text != 'הושלמה'
        AND t.estimated_end IS NOT NULL
        AND t.estimated_end < v_now
      WHEN 'all' THEN
        TRUE
      ELSE
        (t.estimated_end >= v_today_start AND t.estimated_end <= v_today_end)
        OR (t.estimated_start >= v_today_start AND t.estimated_start <= v_today_end)
        OR (t.status::text = 'בעבודה' AND t.estimated_end >= v_today_start)
    END
  )
  AND (
    p_cursor_start IS NULL
    OR p_cursor_id IS NULL
    OR (
      CASE
        WHEN t.status::text = 'בעבודה' THEN 1
        WHEN t.status::text = 'בהמתנה' THEN 2
        ELSE 3
      END,
      COALESCE(t.estimated_start, t.updated_at),
      t.id
    ) > (
      CASE
        WHEN (SELECT t2.status::text FROM tasks t2 WHERE t2.id = p_cursor_id) = 'בעבודה' THEN 1
        WHEN (SELECT t2.status::text FROM tasks t2 WHERE t2.id = p_cursor_id) = 'בהמתנה' THEN 2
        ELSE 3
      END,
      p_cursor_start,
      p_cursor_id
    )
  )
  ORDER BY
    -- Status priority: בעבודה (1), בהמתנה (2), others (3)
    CASE
      WHEN t.status::text = 'בעבודה' THEN 1
      WHEN t.status::text = 'בהמתנה' THEN 2
      ELSE 3
    END ASC,
    -- Within each status group, order by estimated_start (nulls last)
    COALESCE(t.estimated_start, t.updated_at) ASC,
    -- Tie-breaker
    t.id ASC
  LIMIT p_limit;
END;
$$;

-- 7. Grants
GRANT ALL ON public.clients_vehicles TO postgres;
GRANT ALL ON public.clients_vehicles TO service_role;
GRANT SELECT ON public.clients_vehicles TO authenticated;
GRANT SELECT ON public.clients_vehicles TO anon;
GRANT EXECUTE ON FUNCTION public.get_driver_tasks TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_tasks TO anon;
