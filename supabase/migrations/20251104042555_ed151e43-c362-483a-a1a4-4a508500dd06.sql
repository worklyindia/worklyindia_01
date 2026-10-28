-- ============================================================================
-- Team & Role Management - Complete Fix & Enhancement Migration
-- ============================================================================
-- This migration includes:
-- 1. Fix for get_team_members JOIN issue
-- 2. Email retrieval helper function
-- 3. Performance indexes
-- 4. Rate limiting tracking
-- 5. Audit log archival system
-- ============================================================================

-- ============================================================================
-- PART 1: CRITICAL FIXES
-- ============================================================================

-- Step 1: Create helper function to safely get user emails from auth.users
CREATE OR REPLACE FUNCTION public.get_user_email(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO authenticated;

-- Step 2: Drop and recreate get_team_members with correct JOIN and email function
DROP FUNCTION IF EXISTS public.get_team_members();

CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role text,
  permissions jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  profile_image_url text,
  phone text,
  location text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view team members';
  END IF;

  RETURN QUERY
  SELECT 
    au.user_id,
    COALESCE(public.get_user_email(au.user_id), au.user_id::text) as email,
    COALESCE(p.full_name, 'Unknown User') as full_name,
    au.role,
    COALESCE(ap.permissions, '{}'::jsonb) as permissions,
    (SELECT last_sign_in_at FROM auth.users WHERE id = au.user_id) as last_sign_in_at,
    au.created_at,
    p.profile_image_url,
    p.phone,
    p.location
  FROM admin_users au
  LEFT JOIN profiles p ON p.user_id = au.user_id
  LEFT JOIN admin_permissions ap ON ap.user_id = au.user_id
  ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_members() TO authenticated;

-- ============================================================================
-- PART 2: PERFORMANCE IMPROVEMENTS
-- ============================================================================

-- Create indexes for faster team member queries
CREATE INDEX IF NOT EXISTS idx_admin_users_role 
  ON admin_users(role);

CREATE INDEX IF NOT EXISTS idx_admin_users_created_at 
  ON admin_users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id 
  ON admin_users(user_id);

-- Create indexes for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_admin_permissions_user_id 
  ON admin_permissions(user_id);

-- Create indexes for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id 
  ON admin_audit_logs(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user_id 
  ON admin_audit_logs(target_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at 
  ON admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_type 
  ON admin_audit_logs(action_type);

-- Create index for profiles lookup by user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
  ON profiles(user_id);

-- ============================================================================
-- PART 3: RATE LIMITING SYSTEM
-- ============================================================================

-- Create rate limiting tracking table
CREATE TABLE IF NOT EXISTS admin_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  attempt_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for rate limit checks
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action 
  ON admin_rate_limits(user_id, action_type, window_start);

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_admin_rate_limit(
  p_user_id uuid,
  p_action_type text,
  p_max_attempts integer DEFAULT 10,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_count integer;
  v_window_start timestamptz;
BEGIN
  -- Get current rate limit record within window
  SELECT attempt_count, window_start
  INTO v_attempt_count, v_window_start
  FROM admin_rate_limits
  WHERE user_id = p_user_id 
    AND action_type = p_action_type
    AND window_start > (now() - (p_window_minutes || ' minutes')::interval)
  ORDER BY window_start DESC
  LIMIT 1;
  
  -- If no record or window expired, create new window
  IF v_attempt_count IS NULL OR v_window_start < (now() - (p_window_minutes || ' minutes')::interval) THEN
    INSERT INTO admin_rate_limits (user_id, action_type, attempt_count, window_start)
    VALUES (p_user_id, p_action_type, 1, now());
    RETURN true;
  END IF;
  
  -- Check if limit exceeded
  IF v_attempt_count >= p_max_attempts THEN
    RETURN false;
  END IF;
  
  -- Increment counter
  UPDATE admin_rate_limits
  SET attempt_count = attempt_count + 1,
      updated_at = now()
  WHERE user_id = p_user_id 
    AND action_type = p_action_type
    AND window_start = v_window_start;
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION check_admin_rate_limit(uuid, text, integer, integer) TO authenticated;

-- ============================================================================
-- PART 4: AUDIT LOG RETENTION & ARCHIVAL
-- ============================================================================

-- Create archive table for old audit logs
CREATE TABLE IF NOT EXISTS admin_audit_logs_archive (
  LIKE admin_audit_logs INCLUDING ALL
);

-- Add archived_at timestamp
ALTER TABLE admin_audit_logs_archive 
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT now();

-- Function to archive old audit logs (older than 90 days)
CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count integer := 0;
BEGIN
  -- Insert old logs into archive
  INSERT INTO admin_audit_logs_archive (
    id, admin_user_id, admin_email, admin_name, action_type,
    target_user_id, target_email, changes, ip_address, user_agent,
    created_at, archived_at
  )
  SELECT 
    id, admin_user_id, admin_email, admin_name, action_type,
    target_user_id, target_email, changes, ip_address, user_agent,
    created_at, now()
  FROM admin_audit_logs
  WHERE created_at < (now() - interval '90 days');
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  -- Delete archived logs from main table
  DELETE FROM admin_audit_logs
  WHERE created_at < (now() - interval '90 days');
  
  RETURN archived_count;
END;
$$;

GRANT EXECUTE ON FUNCTION archive_old_audit_logs() TO authenticated;

-- Create index on archive table
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_created_at 
  ON admin_audit_logs_archive(created_at DESC);

-- ============================================================================
-- PART 5: ENHANCED AUDIT FUNCTIONS
-- ============================================================================

-- Function to get audit logs with archive support
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_action_type text DEFAULT NULL,
  p_include_archived boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  admin_user_id uuid,
  admin_email text,
  admin_name text,
  action_type text,
  target_user_id uuid,
  target_email text,
  changes jsonb,
  ip_address text,
  logged_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view audit logs';
  END IF;

  IF p_include_archived THEN
    -- Query both main and archive tables
    RETURN QUERY
    (
      SELECT 
        al.id,
        al.admin_user_id,
        al.admin_email,
        al.admin_name,
        al.action_type,
        al.target_user_id,
        al.target_email,
        al.changes,
        al.ip_address,
        al.created_at as logged_at
      FROM admin_audit_logs al
      WHERE p_action_type IS NULL OR al.action_type = p_action_type
      
      UNION ALL
      
      SELECT 
        ala.id,
        ala.admin_user_id,
        ala.admin_email,
        ala.admin_name,
        ala.action_type,
        ala.target_user_id,
        ala.target_email,
        ala.changes,
        ala.ip_address,
        ala.created_at as logged_at
      FROM admin_audit_logs_archive ala
      WHERE p_action_type IS NULL OR ala.action_type = p_action_type
    )
    ORDER BY logged_at DESC
    LIMIT p_limit OFFSET p_offset;
  ELSE
    -- Query only main table
    RETURN QUERY
    SELECT 
      al.id,
      al.admin_user_id,
      al.admin_email,
      al.admin_name,
      al.action_type,
      al.target_user_id,
      al.target_email,
      al.changes,
      al.ip_address,
      al.created_at as logged_at
    FROM admin_audit_logs al
    WHERE p_action_type IS NULL OR al.action_type = p_action_type
    ORDER BY al.created_at DESC
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_audit_logs(integer, integer, text, boolean) TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Team & Role Management migration completed successfully!';
  RAISE NOTICE '   - Fixed get_team_members JOIN issue';
  RAISE NOTICE '   - Added get_user_email helper function';
  RAISE NOTICE '   - Created performance indexes';
  RAISE NOTICE '   - Added rate limiting system';
  RAISE NOTICE '   - Set up audit log archival';
END $$;