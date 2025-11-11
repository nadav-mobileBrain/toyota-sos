-- Supabase RLS policies (Task 3.2)
-- This file enables RLS and adds policies for each table.

-- Avoid conflict with PostgreSQL CURRENT_ROLE keyword by using a different name
create or replace function public.app_user_role()
returns role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
$$;

-- =========================
-- Enable RLS
-- =========================
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.vehicles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_forms enable row level security;
alter table public.signatures enable row level security;
alter table public.images enable row level security;
alter table public.notifications enable row level security;
alter table public.feature_flags enable row level security;
alter table public.task_audit_log enable row level security;

-- =========================
-- profiles
-- =========================
drop policy if exists profiles_select_self_or_read_all on public.profiles;
create policy profiles_select_self_or_read_all
on public.profiles for select
using (
  auth.uid() is null  -- allow unauthenticated reads (driver login flow)
  or (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role OR app_user_role() = 'viewer'::role)
  or id = auth.uid()
);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles for update
using (
  id = auth.uid() or (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role)
)
with check (
  id = auth.uid() or (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role)
);

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
on public.profiles for insert
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

-- =========================
-- clients (read for all roles; write admin/manager)
-- =========================
drop policy if exists clients_read_all on public.clients;
create policy clients_read_all
on public.clients for select
using ( true );

drop policy if exists clients_write_admin on public.clients;
create policy clients_write_admin
on public.clients for all
using ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role )
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

-- =========================
-- vehicles
-- =========================
drop policy if exists vehicles_read_all on public.vehicles;
create policy vehicles_read_all
on public.vehicles for select
using ( true );

drop policy if exists vehicles_write_admin on public.vehicles;
create policy vehicles_write_admin
on public.vehicles for all
using ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role )
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

-- =========================
-- tasks
-- Drivers: can select assigned tasks; Admin/Manager: full; Viewer: read-only all
-- Drivers UPDATE limited notion (see note): allow update when assigned (column-level enforcement can be added via triggers)
-- =========================
drop policy if exists tasks_select_role_based on public.tasks;
create policy tasks_select_role_based
on public.tasks for select
using (
  (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role OR app_user_role() = 'viewer'::role)
  or exists (
    select 1 from public.task_assignees ta
    where ta.task_id = tasks.id and ta.driver_id = auth.uid()
  )
);

drop policy if exists tasks_write_admin on public.tasks;
create policy tasks_write_admin
on public.tasks for all
using ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role )
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

drop policy if exists tasks_driver_update_assigned on public.tasks;
create policy tasks_driver_update_assigned
on public.tasks for update
using (
  exists (
    select 1 from public.task_assignees ta
    where ta.task_id = tasks.id and ta.driver_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.task_assignees ta
    where ta.task_id = tasks.id and ta.driver_id = auth.uid()
  )
);

-- =========================
-- task_assignees
-- =========================
drop policy if exists task_assignees_select_role_based on public.task_assignees;
create policy task_assignees_select_role_based
on public.task_assignees for select
using (
  (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role OR app_user_role() = 'viewer'::role)
  or driver_id = auth.uid()
);

drop policy if exists task_assignees_write_admin on public.task_assignees;
create policy task_assignees_write_admin
on public.task_assignees for all
using ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role )
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

-- =========================
-- task_forms (drivers: own only; admin/manager full; viewer read-only all)
-- =========================
drop policy if exists task_forms_select_role_based on public.task_forms;
create policy task_forms_select_role_based
on public.task_forms for select
using (
  (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role OR app_user_role() = 'viewer'::role)
  or driver_id = auth.uid()
);

drop policy if exists task_forms_driver_write_own on public.task_forms;
-- Split into separate insert and update policies for correct syntax
create policy task_forms_driver_insert_own
on public.task_forms for insert
with check ( driver_id = auth.uid() );

create policy task_forms_driver_update_own
on public.task_forms for update
using ( driver_id = auth.uid() )
with check ( driver_id = auth.uid() );

drop policy if exists task_forms_write_admin on public.task_forms;
create policy task_forms_write_admin
on public.task_forms for all
using ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role )
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

-- =========================
-- signatures
-- =========================
drop policy if exists signatures_select_role_based on public.signatures;
create policy signatures_select_role_based
on public.signatures for select
using (
  (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role OR app_user_role() = 'viewer'::role)
  or driver_id = auth.uid()
);

drop policy if exists signatures_driver_write_own on public.signatures;
-- Split into insert and update
create policy signatures_driver_insert_own
on public.signatures for insert
with check ( driver_id = auth.uid() );

create policy signatures_driver_update_own
on public.signatures for update
using ( driver_id = auth.uid() )
with check ( driver_id = auth.uid() );

drop policy if exists signatures_write_admin on public.signatures;
create policy signatures_write_admin
on public.signatures for all
using ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role )
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

-- =========================
-- images
-- =========================
drop policy if exists images_select_role_based on public.images;
create policy images_select_role_based
on public.images for select
using (
  (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role OR app_user_role() = 'viewer'::role)
  or driver_id = auth.uid()
);

drop policy if exists images_driver_write_own on public.images;
-- Split into insert and update
create policy images_driver_insert_own
on public.images for insert
with check ( driver_id = auth.uid() );

create policy images_driver_update_own
on public.images for update
using ( driver_id = auth.uid() )
with check ( driver_id = auth.uid() );

drop policy if exists images_write_admin on public.images;
create policy images_write_admin
on public.images for all
using ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role )
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

-- =========================
-- notifications
-- =========================
drop policy if exists notifications_select_role_based on public.notifications;
create policy notifications_select_role_based
on public.notifications for select
using (
  (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role)
  or user_id = auth.uid()
);

drop policy if exists notifications_update_self_or_admin on public.notifications;
create policy notifications_update_self_or_admin
on public.notifications for update
using (
  (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role) or user_id = auth.uid()
)
with check (
  (app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role) or user_id = auth.uid()
);

drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_admin
on public.notifications for insert
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

-- =========================
-- feature_flags
-- =========================
drop policy if exists feature_flags_select_all on public.feature_flags;
create policy feature_flags_select_all
on public.feature_flags for select
using ( true );

drop policy if exists feature_flags_write_admin on public.feature_flags;
create policy feature_flags_write_admin
on public.feature_flags for all
using ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role )
with check ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );

-- =========================
-- task_audit_log (read admin/manager only; writes via triggers)
-- =========================
drop policy if exists audit_read_admin on public.task_audit_log;
create policy audit_read_admin
on public.task_audit_log for select
using ( app_user_role() = 'admin'::role OR app_user_role() = 'manager'::role );


