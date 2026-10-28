-- Recover deleted companies by changing their status back to active
UPDATE public.companies 
SET 
  account_status = 'active',
  account_status_reason = NULL,
  updated_at = now()
WHERE account_status = 'deleted' 
  AND company_name IN ('Workly India', 'GFH', 'My Company');

-- Create audit table for tracking company status changes
CREATE TABLE IF NOT EXISTS public.company_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.company_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access to audit logs
CREATE POLICY "Admins can manage company audit logs" 
ON public.company_audit_logs 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.admin_users 
  WHERE user_id = auth.uid() 
  AND role IN ('admin', 'owner')
));