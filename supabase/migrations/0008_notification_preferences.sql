-- Task 6.7: Add notification preferences table and RLS

-- Notification preferences per user
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null, -- 'assigned', 'updated', 'started', 'completed', 'blocked'
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, event_type)
);

-- RLS
alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own
on public.notification_preferences for select
using (
  auth.uid() is null  -- allow unauthenticated reads (check user's prefs after login)
  or user_id = auth.uid()
  or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own
on public.notification_preferences for update
using (
  user_id = auth.uid()
  or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
)
with check (
  user_id = auth.uid()
  or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own
on public.notification_preferences for insert
with check (
  user_id = auth.uid()
  or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
);

drop policy if exists notification_preferences_delete_own on public.notification_preferences;
create policy notification_preferences_delete_own
on public.notification_preferences for delete
using (
  user_id = auth.uid()
  or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
);

-- Index for quick lookups
create index if not exists idx_notification_preferences_user_id on public.notification_preferences (user_id);

