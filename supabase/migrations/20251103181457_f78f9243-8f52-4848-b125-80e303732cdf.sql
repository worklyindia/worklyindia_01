-- Create rate_limits table for security hardening
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  last_attempt timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_type)
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for rate_limits
CREATE POLICY "Users can view their own rate limits"
  ON public.rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage rate limits"
  ON public.rate_limits FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
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
  v_user_id uuid;
  v_attempts integer;
  v_window_start timestamp with time zone;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current rate limit record
  SELECT attempts, window_start INTO v_attempts, v_window_start
  FROM rate_limits
  WHERE user_id = v_user_id AND action_type = p_action_type;

  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO rate_limits (user_id, action_type, attempts, window_start)
    VALUES (v_user_id, p_action_type, 1, now());
    RETURN true;
  END IF;

  -- Check if window has expired
  IF (now() - v_window_start) > (p_window_minutes || ' minutes')::interval THEN
    -- Reset the window
    UPDATE rate_limits
    SET attempts = 1, window_start = now(), last_attempt = now()
    WHERE user_id = v_user_id AND action_type = p_action_type;
    RETURN true;
  END IF;

  -- Check if limit exceeded
  IF v_attempts >= p_max_attempts THEN
    RETURN false;
  END IF;

  -- Increment attempts
  UPDATE rate_limits
  SET attempts = attempts + 1, last_attempt = now()
  WHERE user_id = v_user_id AND action_type = p_action_type;
  
  RETURN true;
END;
$$;

-- Add admin_audit_logs missing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_audit_logs' 
                 AND column_name = 'admin_user_id') THEN
    ALTER TABLE public.admin_audit_logs ADD COLUMN admin_user_id uuid;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_audit_logs' 
                 AND column_name = 'admin_email') THEN
    ALTER TABLE public.admin_audit_logs ADD COLUMN admin_email text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_audit_logs' 
                 AND column_name = 'admin_name') THEN
    ALTER TABLE public.admin_audit_logs ADD COLUMN admin_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_audit_logs' 
                 AND column_name = 'action_type') THEN
    ALTER TABLE public.admin_audit_logs ADD COLUMN action_type text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_audit_logs' 
                 AND column_name = 'target_user_id') THEN
    ALTER TABLE public.admin_audit_logs ADD COLUMN target_user_id uuid;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_audit_logs' 
                 AND column_name = 'target_email') THEN
    ALTER TABLE public.admin_audit_logs ADD COLUMN target_email text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_audit_logs' 
                 AND column_name = 'changes') THEN
    ALTER TABLE public.admin_audit_logs ADD COLUMN changes jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_audit_logs' 
                 AND column_name = 'ip_address') THEN
    ALTER TABLE public.admin_audit_logs ADD COLUMN ip_address text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_audit_logs' 
                 AND column_name = 'logged_at') THEN
    ALTER TABLE public.admin_audit_logs ADD COLUMN logged_at timestamp with time zone DEFAULT now();
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.rate_limits(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user ON public.admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user ON public.admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_type ON public.admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_logged_at ON public.admin_audit_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin ON public.admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_logged_at ON public.admin_activity_log(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_roles_name ON public.team_roles(role_name);
CREATE INDEX IF NOT EXISTS idx_team_roles_custom ON public.team_roles(is_custom);

-- Add comment for documentation
COMMENT ON TABLE public.rate_limits IS 'Rate limiting for security-sensitive operations';
COMMENT ON FUNCTION public.check_rate_limit IS 'Check if user has exceeded rate limit for an action';
