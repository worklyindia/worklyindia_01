-- Fix RLS policies for verification_purchases to allow service role operations
DROP POLICY IF EXISTS "System can update verification purchases" ON verification_purchases;

-- Allow system (service role) to insert and update verification purchases
CREATE POLICY "System can manage verification purchases" 
ON verification_purchases 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Ensure proper permissions for activation function
GRANT ALL ON verification_purchases TO service_role;