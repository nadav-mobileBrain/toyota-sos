-- Feature Flags table and basic indexes
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

create index if not exists idx_feature_flags_updated_at on public.feature_flags (updated_at desc);

-- Optional: RLS can be set according to your needs; for now, leave off and access via API with server-role
-- alter table public.feature_flags enable row level security;
-- Example policies if you later enable RLS:
-- create policy "read_flags" on public.feature_flags for select using (true);
-- create policy "write_flags_admin" on public.feature_flags for update using (auth.role() = 'admin');


