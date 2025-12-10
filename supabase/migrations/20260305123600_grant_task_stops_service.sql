-- Ensure service_role can read task_stops (needed for admin/server fetches)
grant select on public.task_stops to service_role;
