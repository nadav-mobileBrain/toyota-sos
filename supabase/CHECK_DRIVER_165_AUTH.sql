-- Check if driver 165 has a Supabase auth account
-- Run this in Supabase SQL Editor

-- 1. Check profiles table for driver 165
SELECT id, employee_id, name, email, role
FROM public.profiles
WHERE employee_id = '165' OR employee_id LIKE '%165%';

-- 2. Check if auth.users has an account for this driver
SELECT id, email, email_confirmed_at, last_sign_in_at, created_at
FROM auth.users
WHERE email LIKE '%165%';

-- 3. Check if there's a profile/auth mismatch
SELECT
  p.id as profile_id,
  p.employee_id,
  p.email as profile_email,
  p.name,
  u.id as auth_id,
  u.email as auth_email,
  u.email_confirmed_at,
  u.last_sign_in_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.employee_id = '165' OR p.employee_id LIKE '%165%';
