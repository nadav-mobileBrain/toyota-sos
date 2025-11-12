-- Task Audit Log: table, diff function, trigger function and triggers
-- Safely create required extension
create extension if not exists pgcrypto;

-- Table to store audit logs of task mutations
create table if not exists public.task_audit_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  actor_id uuid null,
  action text not null check (action in ('created','updated')),
  changed_at timestamptz not null default now(),
  before jsonb,
  after jsonb,
  diff jsonb
);

-- Indexes for efficient querying
create index if not exists idx_task_audit_log_task_id on public.task_audit_log (task_id);
create index if not exists idx_task_audit_log_changed_at on public.task_audit_log (changed_at desc);

-- Helper function: compute shallow field-level diff between two jsonb objects
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

-- Trigger function to write audit rows on INSERT/UPDATE of tasks
create or replace function public.task_audit_trigger()
returns trigger language plpgsql security definer as $$
declare
  v_actor uuid;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
  -- Exclude fields that shouldn't be audited (adjust if needed)
  excluded_keys text[] := array[
    -- add sensitive or noisy fields here if needed
    'updated_at'
  ];
begin
  -- Capture actor from auth context if available; falls back to null for service role
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
    -- Only record when there are actual changes
    if (v_diff is not null and v_diff <> '{}'::jsonb) then
      insert into public.task_audit_log(task_id, actor_id, action, before, after, diff)
      values (NEW.id, v_actor, 'updated', v_before, v_after, v_diff);
    end if;
    return NEW;
  end if;
  return NEW;
end;
$$;

-- Attach triggers to tasks table
drop trigger if exists trg_task_audit_insert on public.tasks;
drop trigger if exists trg_task_audit_update on public.tasks;

create trigger trg_task_audit_insert
after insert on public.tasks
for each row execute function public.task_audit_trigger();

create trigger trg_task_audit_update
after update on public.tasks
for each row execute function public.task_audit_trigger();

-- RLS: leave disabled by default for audit log; prefer server-side access via service role
-- If enabling RLS later, add policies to allow admin/manager reads only.


