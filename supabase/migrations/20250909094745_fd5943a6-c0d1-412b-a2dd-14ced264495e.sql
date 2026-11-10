-- Create edge_functions table
CREATE TABLE public.edge_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  code TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  last_deployed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on edge_functions
ALTER TABLE public.edge_functions ENABLE ROW LEVEL SECURITY;

-- Create policy for edge_functions (admin only access)
CREATE POLICY "Only admins can access edge_functions" 
ON public.edge_functions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Add tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.edge_functions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.function_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.secrets_management;

-- Set replica identity for realtime
ALTER TABLE public.edge_functions REPLICA IDENTITY FULL;
ALTER TABLE public.function_logs REPLICA IDENTITY FULL;
ALTER TABLE public.secrets_management REPLICA IDENTITY FULL;

-- Seed edge_functions with existing functions
INSERT INTO public.edge_functions (name, description, status) VALUES
('cleanup-interviews', 'Cleanup old interview records', 'active'),
('create-boost-order', 'Create Razorpay order for job boost', 'active'),
('create-razorpay-order', 'Create Razorpay order for points purchase', 'active'),
('create-verification-order', 'Create Razorpay order for company verification', 'active'),
('expire-job-boosts', 'Expire outdated job boosts', 'active'),
('publish-scheduled-jobs', 'Publish scheduled job posts', 'active'),
('razorpay-webhook', 'Handle Razorpay payment webhooks', 'active'),
('update-trending-scores', 'Update job trending scores', 'active'),
('verify-boost-payment', 'Verify job boost payment', 'active'),
('verify-payment', 'Verify points purchase payment', 'active'),
('verify-verification-payment', 'Verify company verification payment', 'active'),
('manage-functions', 'Manage edge functions', 'active'),
('manage-secrets', 'Manage secrets', 'active')
ON CONFLICT (name) DO NOTHING;

-- Seed some common secrets metadata
INSERT INTO public.secrets_management (secret_key, description, used_by_functions) VALUES
('RAZORPAY_KEY_ID', 'Razorpay API Key ID for payments', ARRAY['create-razorpay-order', 'create-boost-order', 'create-verification-order', 'razorpay-webhook']),
('RAZORPAY_KEY_SECRET', 'Razorpay API Secret for payment verification', ARRAY['verify-payment', 'verify-boost-payment', 'verify-verification-payment', 'razorpay-webhook']),
('OPENAI_API_KEY', 'OpenAI API key for AI features', ARRAY[])
ON CONFLICT (secret_key) DO NOTHING;

-- Ensure admin user exists (replace with actual user email if known)
-- This is a placeholder - admin should manually add their user to admin_users table