-- Ensure driver_breaks changes are emitted via Supabase Realtime
-- (table must be part of the supabase_realtime publication)

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_breaks'
  ) then
    alter publication supabase_realtime add table public.driver_breaks;
  end if;
end $$;


