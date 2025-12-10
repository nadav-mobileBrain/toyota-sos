-- Support multiple clients/addresses/advisors per task (for multi-stop rides)
-- Creates task_stops table + RLS policies mirroring task visibility rules

-- Table
create table if not exists public.task_stops (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  address text not null default '',
  advisor_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_stops_task_order
  on public.task_stops (task_id, sort_order);

alter table public.task_stops enable row level security;

-- RLS: same visibility as tasks (drivers can see stops for assigned tasks; admin/manager/viewer can read; admin/manager write)
drop policy if exists task_stops_select_role_based on public.task_stops;
create policy task_stops_select_role_based
on public.task_stops for select
using (
  (app_user_role() = 'admin'::role or app_user_role() = 'manager'::role or app_user_role() = 'viewer'::role)
  or exists (
    select 1 from public.task_assignees ta
    where ta.task_id = task_stops.task_id
      and ta.driver_id = auth.uid()
  )
);

drop policy if exists task_stops_write_admin on public.task_stops;
create policy task_stops_write_admin
on public.task_stops for all
using (app_user_role() = 'admin'::role or app_user_role() = 'manager'::role)
with check (app_user_role() = 'admin'::role or app_user_role() = 'manager'::role);

-- Grants (required alongside RLS policies)
grant select on public.task_stops to authenticated;
grant select on public.task_stops to anon;
grant insert on public.task_stops to service_role;
grant update on public.task_stops to service_role;
grant delete on public.task_stops to service_role;
