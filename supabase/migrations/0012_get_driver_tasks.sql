-- Create RPC function to fetch driver tasks with pagination and filtering
-- Identifies the driver by:
--   1. auth.uid() if authenticated via Supabase Auth
--   2. p_driver_id parameter if provided (for localStorage-only sessions)
-- This allows drivers who log in with employee_id only (not email/password) to still use this function

-- Drop existing function if it exists (in case return type changed)
-- Include all possible signatures
drop function if exists public.get_driver_tasks(text, integer, timestamptz, uuid, uuid);
drop function if exists public.get_driver_tasks(text, integer, timestamptz, uuid);
drop function if exists public.get_driver_tasks(text, integer);
drop function if exists public.get_driver_tasks(text);
drop function if exists public.get_driver_tasks();

create or replace function public.get_driver_tasks(
  p_tab text default 'today',
  p_limit integer default 10,
  p_cursor_updated timestamptz default null,
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
  updated_at timestamptz
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
  -- First try auth.uid() (if authenticated via Supabase Auth)
  v_driver_id := auth.uid();

  -- If auth.uid() is null, try using the provided p_driver_id parameter
  -- This allows drivers using localStorage-only sessions to pass their driver_id
  if v_driver_id is null and p_driver_id is not null then
    v_driver_id := p_driver_id;
  end if;

  -- Verify this is actually a driver profile
  if v_driver_id is not null then
    select p.id into v_driver_id
    from public.profiles p
    where p.id = v_driver_id
    and p.role = 'driver'
    limit 1;
  end if;

  -- If still no driver ID found, return empty
  if v_driver_id is null then
    return;
  end if;

  -- Calculate today's range (start of day to end of day in Israel timezone)
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
    t.updated_at
  from public.tasks t
  inner join public.task_assignees ta on ta.task_id = t.id
  where ta.driver_id = v_driver_id
  and (
    case p_tab
      when 'today' then
        -- Tasks that are due today or started today
        (t.estimated_end >= v_today_start and t.estimated_end <= v_today_end)
        or (t.estimated_start >= v_today_start and t.estimated_start <= v_today_end)
        -- NOTE: compare status via text to avoid enum value mismatches across environments
        or (t.status::text = 'in_progress' and t.estimated_end >= v_today_start)
      when 'overdue' then
        -- Tasks that are not completed and past their estimated_end
        t.status::text != 'completed'
        and t.estimated_end is not null
        and t.estimated_end < v_now
      when 'all' then
        -- All tasks assigned to this driver
        true
      else
        -- Default to today if invalid tab
        (t.estimated_end >= v_today_start and t.estimated_end <= v_today_end)
        or (t.estimated_start >= v_today_start and t.estimated_start <= v_today_end)
        or (t.status::text = 'in_progress' and t.estimated_end >= v_today_start)
    end
  )
  -- Pagination cursor: if cursor provided, get tasks after that cursor
  and (
    p_cursor_updated is null
    or p_cursor_id is null
    or (t.updated_at > p_cursor_updated)
    or (t.updated_at = p_cursor_updated and t.id > p_cursor_id)
  )
  order by t.updated_at desc, t.id desc
  limit p_limit;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_driver_tasks to authenticated;
grant execute on function public.get_driver_tasks to anon;

