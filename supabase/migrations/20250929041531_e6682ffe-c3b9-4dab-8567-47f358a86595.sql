-- Grant admin access to the Gmail user so Website Users Management works
-- Uses the user id observed in recent auth logs
INSERT INTO public.admin_users (user_id, role)
VALUES ('1769cddb-7244-4b4b-a86f-e0ca3bc028db', 'owner')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  updated_at = now();

-- Optional: ensure another known admin id remains admin (no-op if not present)
INSERT INTO public.admin_users (user_id, role)
VALUES ('aeaee4a9-d898-4fe7-b4ff-02d66feb56e1', 'admin')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  updated_at = now();