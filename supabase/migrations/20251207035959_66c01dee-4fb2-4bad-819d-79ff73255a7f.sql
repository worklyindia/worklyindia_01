-- Add DELETE policy for whatsapp_messages table
CREATE POLICY "Admins can delete whatsapp messages" 
ON public.whatsapp_messages 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);