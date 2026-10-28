-- Add gohilvishal7600@gmail.com as owner in admin_users table
INSERT INTO public.admin_users (user_id, role, created_by)
VALUES ('5e9cf05e-89c1-474a-9071-91fd05956036', 'owner', '5e9cf05e-89c1-474a-9071-91fd05956036')
ON CONFLICT (user_id) DO UPDATE SET role = 'owner', updated_at = now();