-- Make caller_id nullable for webhook-created entries
ALTER TABLE voice_call_logs ALTER COLUMN caller_id DROP NOT NULL;

-- Add RLS policy for service role to insert
CREATE POLICY "Service role can insert voice call logs"
ON voice_call_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Add RLS policy for service role to update
CREATE POLICY "Service role can update voice call logs"
ON voice_call_logs
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);