-- Fix password for driver 165
-- The auth account exists but password doesn't match Driver@165

-- Update the password for driver 165
UPDATE auth.users
SET
  encrypted_password = crypt('Driver@165', gen_salt('bf')),
  updated_at = now()
WHERE email = 'driver+165@toyota.local';

-- Verify the update
SELECT
  id,
  email,
  email_confirmed_at,
  last_sign_in_at,
  created_at,
  updated_at
FROM auth.users
WHERE email = 'driver+165@toyota.local';

-- Now test login:
-- 1. Clear browser localStorage and cookies
-- 2. Try logging in with employee ID: 165
-- 3. The password should be: Driver@165
-- 4. Check console for: "✅ Driver authenticated with Supabase - Realtime enabled"
