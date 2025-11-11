-- Migration: Sync user roles from profiles table to auth.users user_metadata
-- Purpose: Ensure all admin/manager/viewer users have their role in user_metadata
-- This fixes login redirects where role wasn't properly set

-- Note: This requires running via Supabase dashboard SQL Editor with service_role privileges
-- Because we need to update auth.users which is not accessible via RLS

-- Check current state - find users missing role in metadata
-- SELECT 
--   u.id,
--   u.email,
--   u.user_metadata->>'role' as auth_role,
--   p.role as profile_role
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON u.id = p.id
-- WHERE u.user_metadata->>'role' IS NULL 
--   OR u.user_metadata->>'role' = ''
--   OR (p.role != 'driver' AND u.user_metadata->>'role' IS DISTINCT FROM p.role);

-- Update a specific user (nadavg1000@gmail.com / nadav admin)
-- Replace USER_ID with the actual UUID from auth.users
UPDATE auth.users
SET user_metadata = jsonb_set(
  COALESCE(user_metadata, '{}'::jsonb),
  '{role}',
  '"admin"'::jsonb
)
WHERE email = 'nadavg1000@gmail.com'
  AND user_metadata->>'role' IS DISTINCT FROM 'admin';

-- Sync all admin/manager/viewer users from profiles to auth metadata
UPDATE auth.users u
SET user_metadata = jsonb_set(
  COALESCE(u.user_metadata, '{}'::jsonb),
  '{role}',
  to_jsonb(p.role)
)
FROM public.profiles p
WHERE u.id = p.id
  AND p.role IN ('admin', 'manager', 'viewer')
  AND (u.user_metadata->>'role' IS DISTINCT FROM p.role OR u.user_metadata->>'role' IS NULL);

-- Verify the sync worked
-- SELECT 
--   u.id,
--   u.email,
--   p.name,
--   p.role,
--   u.user_metadata->>'role' as auth_role
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON u.id = p.id
-- WHERE p.role IN ('admin', 'manager', 'viewer')
-- ORDER BY u.email;

