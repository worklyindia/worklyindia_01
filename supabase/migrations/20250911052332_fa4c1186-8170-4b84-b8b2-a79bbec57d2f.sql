-- Create admin_audit_logs table for tracking admin actions
CREATE TABLE public.admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  target_id UUID,
  target_type TEXT,
  details JSONB,
  performed_by UUID NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Only admins can access audit logs"
ON public.admin_audit_logs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Create database function for ban/unban operations as fallback
CREATE OR REPLACE FUNCTION public.admin_update_company_ban_status(
  p_company_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL,
  p_performed_by UUID DEFAULT auth.uid()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  job_ids UUID[];
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = p_performed_by 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_action = 'ban' THEN
    -- Update company status to banned
    UPDATE public.companies SET
      account_status = 'banned',
      account_status_reason = COALESCE(p_reason, 'Company banned by admin'),
      updated_at = now()
    WHERE user_id = p_user_id;

    -- Get all job IDs for this company
    SELECT ARRAY(
      SELECT id FROM public.jobs WHERE company_id = p_company_id
    ) INTO job_ids;

    -- Update job applications status
    IF array_length(job_ids, 1) > 0 THEN
      UPDATE public.job_applications SET
        status = 'company_banned',
        updated_at = now()
      WHERE job_id = ANY(job_ids);

      -- Remove job favorites
      DELETE FROM public.job_favorites WHERE job_id = ANY(job_ids);

      -- Deactivate jobs
      UPDATE public.jobs SET
        status = 'inactive',
        updated_at = now()
      WHERE company_id = p_company_id;
    END IF;

    -- Create employer notification
    INSERT INTO public.employer_notifications (
      user_id, title, message, type, action_url, metadata
    ) VALUES (
      p_user_id,
      'Account Banned',
      'Your company account has been banned.' || CASE WHEN p_reason IS NOT NULL THEN ' Reason: ' || p_reason ELSE '' END,
      'account',
      '/employer/disabled',
      jsonb_build_object('company_id', p_company_id, 'reason', p_reason, 'action', 'ban', 'performed_by', p_performed_by)
    );

    result := json_build_object(
      'success', true,
      'message', 'Company banned successfully',
      'action', 'ban'
    );

  ELSIF p_action = 'unban' THEN
    -- Update company status to active
    UPDATE public.companies SET
      account_status = 'active',
      account_status_reason = 'Company unbanned by admin',
      updated_at = now()
    WHERE user_id = p_user_id;

    -- Get all job IDs for this company
    SELECT ARRAY(
      SELECT id FROM public.jobs WHERE company_id = p_company_id
    ) INTO job_ids;

    -- Restore job applications status
    IF array_length(job_ids, 1) > 0 THEN
      UPDATE public.job_applications SET
        status = 'applied',
        updated_at = now()
      WHERE status = 'company_banned' AND job_id = ANY(job_ids);

      -- Reactivate jobs
      UPDATE public.jobs SET
        status = 'active',
        updated_at = now()
      WHERE company_id = p_company_id AND status = 'inactive';
    END IF;

    -- Create employer notification
    INSERT INTO public.employer_notifications (
      user_id, title, message, type, action_url, metadata
    ) VALUES (
      p_user_id,
      'Account Restored',
      'Your company account has been reactivated. You can resume posting jobs and using employer features.',
      'account',
      '/employer-portal',
      jsonb_build_object('company_id', p_company_id, 'action', 'unban', 'performed_by', p_performed_by)
    );

    result := json_build_object(
      'success', true,
      'message', 'Company unbanned successfully',
      'action', 'unban'
    );

  ELSE
    RAISE EXCEPTION 'Invalid action. Must be "ban" or "unban"';
  END IF;

  -- Create audit log
  INSERT INTO public.admin_audit_logs (
    action,
    target_id,
    target_type,
    details,
    performed_by
  ) VALUES (
    CASE WHEN p_action = 'ban' THEN 'company_banned' ELSE 'company_unbanned' END,
    p_company_id,
    'company',
    jsonb_build_object('reason', p_reason, 'user_id', p_user_id, 'performed_by', p_performed_by),
    p_performed_by
  );

  RETURN result;
END;
$$;