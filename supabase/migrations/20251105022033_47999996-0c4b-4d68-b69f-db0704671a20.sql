-- Drop the old remove_team_member function with p_ip_address parameter
DROP FUNCTION IF EXISTS public.remove_team_member(UUID, TEXT);

-- Ensure only the correct version exists
DROP FUNCTION IF EXISTS public.remove_team_member(UUID);

-- Recreate the correct version
CREATE OR REPLACE FUNCTION remove_team_member(p_target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_role TEXT;
  v_target_role TEXT;
  v_ip_address TEXT;
  v_admin_email TEXT;
  v_admin_name TEXT;
  v_target_email TEXT;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_current_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;

  SELECT role INTO v_current_role
  FROM admin_users
  WHERE user_id = v_current_user_id;

  IF v_current_role IS NULL THEN
    RAISE EXCEPTION 'You do not have permission to remove team members';
  END IF;

  SELECT role INTO v_target_role
  FROM admin_users
  WHERE user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a team member';
  END IF;

  IF v_current_role = 'owner' THEN
    IF v_target_role = 'owner' THEN
      IF (SELECT COUNT(*) FROM admin_users WHERE role = 'owner') <= 1 THEN
        RAISE EXCEPTION 'Cannot remove the last owner';
      END IF;
    END IF;
  ELSIF v_current_role = 'admin' THEN
    IF v_target_role IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'You cannot remove users with a higher role than yours';
    END IF;
  ELSE
    RAISE EXCEPTION 'You do not have permission to remove team members';
  END IF;

  v_ip_address := current_setting('request.headers', true)::json->>'x-real-ip';

  SELECT au.email INTO v_admin_email
  FROM auth.users au
  WHERE au.id = v_current_user_id;

  SELECT p.full_name INTO v_admin_name
  FROM profiles p
  WHERE p.user_id = v_current_user_id;

  SELECT au.email INTO v_target_email
  FROM auth.users au
  WHERE au.id = p_target_user_id;

  INSERT INTO admin_audit_logs (
    action,
    admin_user_id,
    admin_email,
    admin_name,
    target_user_id,
    target_email,
    changes,
    ip_address,
    performed_by,
    target_id,
    target_type
  ) VALUES (
    'remove_member',
    v_current_user_id,
    v_admin_email,
    v_admin_name,
    p_target_user_id,
    v_target_email,
    jsonb_build_object('removed_role', v_target_role),
    v_ip_address,
    v_current_user_id,
    p_target_user_id,
    'user'
  );

  DELETE FROM admin_permissions WHERE user_id = p_target_user_id;
  DELETE FROM admin_users WHERE user_id = p_target_user_id;
END;
$$;