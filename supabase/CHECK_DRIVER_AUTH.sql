-- Query to check which drivers have Supabase auth accounts
-- Run this BEFORE running the migration to see what's missing

SELECT
  p.employee_id,
  p.name,
  p.email as profile_email,
  CASE
    WHEN u.id IS NOT NULL THEN '✅ Auth account exists'
    ELSE '❌ Missing auth account'
  END as auth_status,
  u.email as auth_email,
  u.email_confirmed_at,
  u.last_sign_in_at
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.role = 'driver'
ORDER BY p.employee_id;

-- Summary count
SELECT
  COUNT(*) FILTER (WHERE u.id IS NOT NULL) as drivers_with_auth,
  COUNT(*) FILTER (WHERE u.id IS NULL) as drivers_without_auth,
  COUNT(*) as total_drivers
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.role = 'driver';
