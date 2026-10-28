-- Remove existing FK constraints completely (no re-add)
ALTER TABLE public.admin_permissions DROP CONSTRAINT IF EXISTS admin_permissions_user_id_fkey;
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_user_id_fkey;
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_created_by_fkey;

-- Add owner role for gohilvishal7600@gmail.com
INSERT INTO admin_users (user_id, role, created_at, updated_at)
VALUES ('5e9cf05e-89c1-474a-9071-91fd05956036', 'owner', now(), now())
ON CONFLICT (user_id) DO UPDATE SET role = 'owner', updated_at = now();