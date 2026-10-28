-- Create the check_role_hierarchy function
CREATE OR REPLACE FUNCTION public.check_role_hierarchy(
  admin_role TEXT, 
  target_role TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_level INTEGER;
  target_level INTEGER;
BEGIN
  -- Return false if either role is NULL
  IF admin_role IS NULL OR target_role IS NULL THEN
    RETURN false;
  END IF;

  -- Assign numeric levels to roles
  admin_level := CASE admin_role
    WHEN 'owner' THEN 100
    WHEN 'admin' THEN 80
    WHEN 'moderator' THEN 60
    WHEN 'support' THEN 40
    WHEN 'viewer' THEN 20
    ELSE 10  -- Custom roles get lowest level
  END;

  target_level := CASE target_role
    WHEN 'owner' THEN 100
    WHEN 'admin' THEN 80
    WHEN 'moderator' THEN 60
    WHEN 'support' THEN 40
    WHEN 'viewer' THEN 20
    ELSE 10  -- Custom roles get lowest level
  END;

  -- Return true if admin has higher or equal level
  RETURN admin_level >= target_level;
END;
$$;

-- Grant execution rights to authenticated users
GRANT EXECUTE ON FUNCTION public.check_role_hierarchy(TEXT, TEXT) TO authenticated;