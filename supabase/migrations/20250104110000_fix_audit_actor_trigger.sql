-- Update task_audit_trigger to fallback to created_by/updated_by columns
-- This is needed because admin API routes use service role client (auth.uid() is null)
-- but explicitly set created_by/updated_by columns.

create or replace function public.task_audit_trigger()
returns trigger language plpgsql security definer as $$
declare
  v_actor uuid;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
  -- Exclude fields that shouldn't be audited
  excluded_keys text[] := array[
    'updated_at'
  ];
begin
  -- Capture actor from auth context if available
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;

  -- Fallback to created_by/updated_by if auth.uid() is null (e.g. service role)
  if v_actor is null then
    if (tg_op = 'INSERT') then
      v_actor := NEW.created_by;
    elsif (tg_op = 'UPDATE') then
      v_actor := NEW.updated_by;
    end if;
  end if;

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
