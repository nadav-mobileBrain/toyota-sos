-- Migration to create Supabase auth accounts for all drivers
-- This is REQUIRED for Realtime subscriptions to work with driver sessions
--
-- After running this migration, drivers will be able to use Realtime subscriptions
-- The email pattern is: driver+{employee_id}@toyota.local
-- The password pattern is: Driver@{employee_id}
-- For example: employee_id "157" -> driver+157@toyota.local with password Driver@157

-- Function to create auth user for a driver profile
create or replace function create_driver_auth_account(
  p_profile_id uuid,
  p_email text,
  p_password text,
  p_employee_id text,
  p_name text
)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  -- Check if auth user already exists
  select id into v_user_id
  from auth.users
  where email = p_email;

  if v_user_id is null then
    -- Create new auth user
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      p_profile_id,
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('employee_id', p_employee_id, 'name', p_name),
      now(),
      now(),
      '',
      '',
      ''
    );

    -- Create identity record
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      p_profile_id,
      jsonb_build_object('sub', p_profile_id::text, 'email', p_email),
      'email',
      now(),
      now(),
      now()
    );

    raise notice 'Created auth account for driver: % (email: %)', p_name, p_email;
  else
    raise notice 'Auth account already exists for: % (email: %)', p_name, p_email;
  end if;
end;
$$;

-- Create auth accounts for all drivers that don't have one yet
do $$
declare
  driver_record record;
  driver_password text;
  numeric_id text;
  driver_email text;
begin
  for driver_record in
    select id, employee_id, name, email
    from public.profiles
    where role = 'driver'
    order by employee_id
  loop
    -- Extract numeric part of employee_id (e.g., "157" from "157" or "D157")
    numeric_id := regexp_replace(driver_record.employee_id, '\D', '', 'g');
    if numeric_id = '' then
      raise notice 'Skipping driver % - invalid employee_id format', driver_record.employee_id;
      continue;
    end if;

    -- Use existing email or generate one (driver+{numeric_id}@toyota.local pattern)
    if driver_record.email is null or driver_record.email = '' then
      driver_email := 'driver+' || numeric_id || '@toyota.local';

      -- Update profile with email
      update public.profiles
      set email = driver_email
      where id = driver_record.id;

      raise notice 'Generated email for driver %: %', driver_record.employee_id, driver_email;
    else
      driver_email := driver_record.email;
    end if;

    -- Generate password: Driver@{numeric_id} (e.g., Driver@157)
    driver_password := 'Driver@' || numeric_id;

    -- Create auth account
    perform create_driver_auth_account(
      driver_record.id,
      driver_email,
      driver_password,
      driver_record.employee_id,
      driver_record.name
    );
  end loop;

  raise notice 'Driver auth account creation complete!';
  raise notice 'IMPORTANT: All drivers can now use Realtime subscriptions';
  raise notice 'Email pattern: driver+{employee_id}@toyota.local';
  raise notice 'Password pattern: Driver@{employee_id}';
  raise notice 'Example: employee_id "157" -> driver+157@toyota.local with password Driver@157';
end $$;

-- Clean up the helper function (optional - comment out if you want to keep it for future use)
-- drop function if exists create_driver_auth_account;

-- Grant necessary permissions
grant usage on schema auth to postgres, authenticated;
grant select on auth.users to postgres, authenticated;
