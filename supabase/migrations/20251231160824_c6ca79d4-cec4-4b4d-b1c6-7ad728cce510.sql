-- Add INSERT policy for cleanup_schedule_settings
CREATE POLICY "Admins can insert cleanup settings"
ON public.cleanup_schedule_settings
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM admin_users 
  WHERE admin_users.user_id = auth.uid() 
  AND admin_users.role IN ('admin', 'owner')
));