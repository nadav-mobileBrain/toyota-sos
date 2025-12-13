-- Grant permissions for real-time subscriptions on driver_breaks table
-- This allows anon/authenticated roles to subscribe to changes for real-time updates

-- Grant SELECT to authenticated and anon roles for real-time subscriptions
grant select on public.driver_breaks to authenticated;
grant select on public.driver_breaks to anon;

-- Note: RLS policies already allow admins/managers/viewers to see all breaks
-- and drivers to see their own breaks, so these grants work with RLS

