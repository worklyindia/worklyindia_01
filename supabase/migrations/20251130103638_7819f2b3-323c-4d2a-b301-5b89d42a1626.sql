-- Add RLS policy for admins to manage AI chat plans
CREATE POLICY "Admins can manage AI chat plans" 
ON public.ai_chat_plans
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role = ANY (ARRAY['admin'::text, 'owner'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role = ANY (ARRAY['admin'::text, 'owner'::text])
  )
);