-- Add current user as admin for development/testing
-- This will allow the Save Changes button to work
INSERT INTO public.admin_users (user_id, role, created_at, updated_at) 
SELECT 
  id, 
  'admin',
  now(),
  now()
FROM auth.users 
WHERE email = 'gohilvishal7600@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  role = 'admin',
  updated_at = now();