-- Add UPDATE policy for users to cancel their own deletion requests
CREATE POLICY "Users can update their own deletion requests"
ON public.account_deletion_requests
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);