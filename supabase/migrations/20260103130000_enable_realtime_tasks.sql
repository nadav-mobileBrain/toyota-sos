-- Ensure tasks and task_assignees changes are emitted via Supabase Realtime
-- This is required for the Admin board to update in real-time when a driver updates a task

do $$
begin
  -- Enable for tasks table
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;

  -- Set replica identity to FULL for tasks to ensure we get old data in updates if needed
  alter table public.tasks replica identity full;

  -- Enable for task_assignees table (important for assignment updates)
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_assignees'
  ) then
    alter publication supabase_realtime add table public.task_assignees;
  end if;

  -- Set replica identity to FULL for task_assignees
  alter table public.task_assignees replica identity full;
end $$;
