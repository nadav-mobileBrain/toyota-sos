-- Diagnostic queries to debug get_driver_tasks function

-- 1. Check if function exists and its signature
select 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosrc as source_code
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public'
and p.proname = 'get_driver_tasks';

-- 2. Check driver profile with employee_id 33333
select 
  p.id,
  p.email,
  p.employee_id,
  p.role,
  p.name,
  case 
    when au.id is not null then 'EXISTS in auth.users'
    else 'MISSING from auth.users'
  end as auth_status
from public.profiles p
left join auth.users au on au.id = p.id
where p.employee_id = '33333' or p.employee_id = 'D33333' or p.employee_id like '%33333%';

-- 3. Check tasks assigned to driver with employee_id 33333
select 
  t.id as task_id,
  t.title,
  t.status,
  ta.driver_id,
  p.employee_id,
  p.name as driver_name
from public.tasks t
inner join public.task_assignees ta on ta.task_id = t.id
left join public.profiles p on p.id = ta.driver_id
where p.employee_id = '33333' or p.employee_id = 'D33333' or p.employee_id like '%33333%';

-- 4. Check all task assignments
select 
  ta.id,
  ta.task_id,
  ta.driver_id,
  p.employee_id,
  p.name as driver_name,
  t.title as task_title
from public.task_assignees ta
left join public.profiles p on p.id = ta.driver_id
left join public.tasks t on t.id = ta.task_id
order by ta.assigned_at desc
limit 20;

