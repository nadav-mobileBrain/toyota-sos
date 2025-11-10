-- Create RPC to fetch a single task with joined client and vehicle details
-- RLS will apply as this function is not marked SECURITY DEFINER.
create or replace function public.get_task_details(task_id uuid)
returns table (
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
  updated_at timestamptz
)
language sql
stable
as $$
  select
    t.id,
    t.title,
    t.type,
    t.priority,
    t.status,
    t.details,
    t.estimated_start,
    t.estimated_end,
    t.address,
    c.name as client_name,
    v.license_plate as vehicle_plate,
    v.model as vehicle_model,
    t.updated_at
  from public.tasks t
  left join public.clients c on c.id = t.client_id
  left join public.vehicles v on v.id = t.vehicle_id
  where t.id = get_task_details.task_id
  limit 1;
$$;


