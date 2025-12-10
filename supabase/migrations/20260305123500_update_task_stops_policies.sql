-- Broaden task_stops select policy to allow service role (auth.uid() is null) while keeping role/assignment guards

drop policy if exists task_stops_select_role_based on public.task_stops;
create policy task_stops_select_role_based
on public.task_stops for select
using (
  auth.uid() is null -- service_role or backend context
  or (app_user_role() = 'admin'::role or app_user_role() = 'manager'::role or app_user_role() = 'viewer'::role)
  or exists (
    select 1 from public.task_assignees ta
    where ta.task_id = task_stops.task_id
      and ta.driver_id = auth.uid()
  )
);
