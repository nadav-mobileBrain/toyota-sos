-- Fix task_audit_log column mismatch
-- Run this if you're getting "column 'before' does not exist" error

-- Drop old triggers and function from migration 0003
drop trigger if exists tasks_audit_insert on public.tasks;
drop trigger if exists tasks_audit_update on public.tasks;
drop trigger if exists tasks_audit_delete on public.tasks;
drop function if exists public.log_task_audit();

-- Drop any other old triggers that might exist
drop trigger if exists trg_task_audit_insert on public.tasks;
drop trigger if exists trg_task_audit_update on public.tasks;

-- Migrate columns if old structure exists
do $$
begin
  -- Rename old columns if they exist
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'task_audit_log' 
    and column_name = 'before_data'
  ) then
    alter table public.task_audit_log rename column before_data to before;
  end if;
  
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'task_audit_log' 
    and column_name = 'after_data'
  ) then
    alter table public.task_audit_log rename column after_data to after;
  end if;
  
  -- Add diff column if it doesn't exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'task_audit_log' 
    and column_name = 'diff'
  ) then
    alter table public.task_audit_log add column diff jsonb;
  end if;
  
  -- Ensure before and after columns exist
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'task_audit_log' 
    and column_name = 'before'
  ) then
    alter table public.task_audit_log add column before jsonb;
  end if;
  
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'task_audit_log' 
    and column_name = 'after'
  ) then
    alter table public.task_audit_log add column after jsonb;
  end if;
end $$;

-- Recreate the trigger function and triggers
create or replace function public.task_audit_trigger()
returns trigger language plpgsql security definer as $$
declare
  v_actor uuid;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
  excluded_keys text[] := array['updated_at'];
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;

  if (tg_op = 'INSERT') then
    v_before := null;
    v_after  := to_jsonb(NEW) - excluded_keys;
    v_diff   := public.task_audit_jsonb_diff(null, v_after);
    insert into public.task_audit_log(task_id, actor_id, action, before, after, diff)
    values (NEW.id, v_actor, 'created', v_before, v_after, v_diff);
    return NEW;
  elsif (tg_op = 'UPDATE') then
    v_before := to_jsonb(OLD) - excluded_keys;
    v_after  := to_jsonb(NEW) - excluded_keys;
    v_diff   := public.task_audit_jsonb_diff(v_before, v_after);
    if (v_diff is not null and v_diff <> '{}'::jsonb) then
      insert into public.task_audit_log(task_id, actor_id, action, before, after, diff)
      values (NEW.id, v_actor, 'updated', v_before, v_after, v_diff);
    end if;
    return NEW;
  end if;
  return NEW;
end;
$$;

-- Ensure the diff function exists
create or replace function public.task_audit_jsonb_diff(before jsonb, after jsonb)
returns jsonb language sql immutable as $$
  with keys as (
    select key
    from (
      select jsonb_object_keys(coalesce(before, '{}')) as key
      union
      select jsonb_object_keys(coalesce(after, '{}')) as key
    ) u
  )
  select coalesce(
    jsonb_object_agg(
      k.key,
      jsonb_build_object(
        'from', before -> k.key,
        'to',   after  -> k.key
      )
    ) filter (where (before -> k.key) is distinct from (after -> k.key)),
    '{}'::jsonb
  )
  from keys k;
$$;

-- Recreate triggers
create trigger trg_task_audit_insert
after insert on public.tasks
for each row execute function public.task_audit_trigger();

create trigger trg_task_audit_update
after update on public.tasks
for each row execute function public.task_audit_trigger();

