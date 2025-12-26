-- Add details field to get_driver_tasks function
drop function if exists public.get_driver_tasks(text, integer, timestamptz, uuid, uuid);

create or replace function public.get_driver_tasks(
  p_tab text default 'today',
  p_limit integer default 10,
  p_cursor_start timestamptz default null,
  p_cursor_id uuid default null,
  p_driver_id uuid default null
)
returns table (
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
  updated_at timestamptz,
  distance_from_garage numeric,
  advisor_name text,
  advisor_color public.advisor_color,
  details text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_now timestamptz := now();
  v_today_start timestamptz;
  v_today_end timestamptz;
begin
  -- Get current driver's profile ID from auth context
  v_driver_id := auth.uid();

  if v_driver_id is null and p_driver_id is not null then
    v_driver_id := p_driver_id;
  end if;

  if v_driver_id is not null then
    select p.id into v_driver_id
    from public.profiles p
    where p.id = v_driver_id
    and p.role = 'driver'
    limit 1;
  end if;

  if v_driver_id is null then
    return;
  end if;

  v_today_start := date_trunc('day', v_now at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
  v_today_end := v_today_start + interval '1 day' - interval '1 second';

  return query
  select
    t.id,
    t.title,
    t.type,
    t.priority,
    t.status,
    t.estimated_start,
    t.estimated_end,
    t.address,
    c.name as client_name,
    c.phone as client_phone,
    v.license_plate as vehicle_license_plate,
    v.model as vehicle_model,
    t.updated_at,
    t.distance_from_garage,
    t.advisor_name,
    t.advisor_color,
    t.details
  from public.tasks t
  inner join public.task_assignees ta on ta.task_id = t.id
  left join public.clients c on c.id = t.client_id
  left join public.vehicles v on v.id = t.vehicle_id
  where ta.driver_id = v_driver_id
  and t.deleted_at is null
  and (
    case p_tab
      when 'today' then
        (t.estimated_end >= v_today_start and t.estimated_end <= v_today_end)
        or (t.estimated_start >= v_today_start and t.estimated_start <= v_today_end)
        or (t.status::text = 'בעבודה' and t.estimated_end >= v_today_start)
      when 'overdue' then
        t.status::text != 'הושלמה'
        and t.estimated_end is not null
        and t.estimated_end < v_now
      when 'all' then
        true
      else
        (t.estimated_end >= v_today_start and t.estimated_end <= v_today_end)
        or (t.estimated_start >= v_today_start and t.estimated_start <= v_today_end)
        or (t.status::text = 'בעבודה' and t.estimated_end >= v_today_start)
    end
  )
  and (
    p_cursor_start is null
    or p_cursor_id is null
    or (
      case
        when t.status::text = 'בעבודה' then 1
        when t.status::text = 'בהמתנה' then 2
        else 3
      end,
      coalesce(t.estimated_start, t.updated_at),
      t.id
    ) > (
      case
        when (select t2.status::text from tasks t2 where t2.id = p_cursor_id) = 'בעבודה' then 1
        when (select t2.status::text from tasks t2 where t2.id = p_cursor_id) = 'בהמתנה' then 2
        else 3
      end,
      p_cursor_start,
      p_cursor_id
    )
  )
  order by
    -- Status priority: בעבודה (1), בהמתנה (2), others (3)
    case
      when t.status::text = 'בעבודה' then 1
      when t.status::text = 'בהמתנה' then 2
      else 3
    end asc,
    -- Within each status group, order by estimated_start (nulls last)
    coalesce(t.estimated_start, t.updated_at) asc,
    -- Tie-breaker
    t.id asc
  limit p_limit;
end;
$$;

grant execute on function public.get_driver_tasks to authenticated;
grant execute on function public.get_driver_tasks to anon;

