-- Ensure the requester email has admin/owner access so Website Users Management can load
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Look up the user id by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'gohilvishal7600@gmail.com' LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found in auth.users', 'gohilvishal7600@gmail.com';
  ELSE
    -- Upsert into admin_users as owner (owner implies admin)
    INSERT INTO public.admin_users (user_id, role, created_at, updated_at)
    VALUES (v_user_id, 'owner', now(), now())
    ON CONFLICT (user_id)
    DO UPDATE SET role = EXCLUDED.role, updated_at = now();

    RAISE NOTICE 'Granted owner role to user %', v_user_id;
  END IF;
END $$;
