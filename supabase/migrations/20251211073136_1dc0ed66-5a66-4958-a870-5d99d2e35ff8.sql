-- Add INSERT policy for app_settings to allow admins to save provider preference
CREATE POLICY "Allow admins to insert app_settings" 
ON public.app_settings 
FOR INSERT 
TO public 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);