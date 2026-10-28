-- ============================================================================
-- CRITICAL SECURITY FIX: Enable RLS on admin tables
-- ============================================================================
-- This migration fixes the security vulnerability where admin_rate_limits
-- and admin_audit_logs_archive tables were created without RLS protection
-- ============================================================================

-- Enable RLS on admin_rate_limits table
ALTER TABLE public.admin_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin_rate_limits
CREATE POLICY "Only admins can view rate limits"
  ON public.admin_rate_limits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid() 
      AND admin_users.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Only admins can insert rate limits"
  ON public.admin_rate_limits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid() 
      AND admin_users.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Only admins can update rate limits"
  ON public.admin_rate_limits
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid() 
      AND admin_users.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Only admins can delete rate limits"
  ON public.admin_rate_limits
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid() 
      AND admin_users.role IN ('admin', 'owner')
    )
  );

-- Enable RLS on admin_audit_logs_archive table
ALTER TABLE public.admin_audit_logs_archive ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin_audit_logs_archive
CREATE POLICY "Only admins can view archived logs"
  ON public.admin_audit_logs_archive
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid() 
      AND admin_users.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Only admins can insert archived logs"
  ON public.admin_audit_logs_archive
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid() 
      AND admin_users.role IN ('admin', 'owner')
    )
  );

-- No UPDATE/DELETE policies for archive table - archives should be immutable

-- Add updated_at trigger for admin_rate_limits
CREATE OR REPLACE FUNCTION update_admin_rate_limits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_admin_rate_limits_timestamp
  BEFORE UPDATE ON public.admin_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_rate_limits_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ CRITICAL SECURITY FIX: RLS enabled on admin_rate_limits and admin_audit_logs_archive';
  RAISE NOTICE '   - admin_rate_limits: RLS enabled with 4 policies';
  RAISE NOTICE '   - admin_audit_logs_archive: RLS enabled with 2 policies (read-only archive)';
  RAISE NOTICE '   - Added update trigger for admin_rate_limits';
END $$;