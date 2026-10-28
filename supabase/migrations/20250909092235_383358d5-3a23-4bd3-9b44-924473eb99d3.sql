-- First, let's sync existing edge functions to the database
-- Insert existing edge functions into the edge_functions table
INSERT INTO public.edge_functions (name, description, status, created_at, updated_at) VALUES
('cleanup-interviews', 'Cleanup old interview records automatically', 'active', now(), now()),
('create-boost-order', 'Create Razorpay order for job boost purchases', 'active', now(), now()),
('create-razorpay-order', 'Create Razorpay order for points purchase', 'active', now(), now()),
('create-verification-order', 'Create Razorpay order for company verification', 'active', now(), now()),
('expire-job-boosts', 'Expire job boosts that have ended', 'active', now(), now()),
('manage-functions', 'Manage edge functions deployment and status', 'active', now(), now()),
('manage-secrets', 'Manage Supabase secrets and configurations', 'active', now(), now()),
('publish-scheduled-jobs', 'Publish scheduled jobs at their designated time', 'active', now(), now()),
('razorpay-webhook', 'Handle Razorpay payment webhooks', 'active', now(), now()),
('update-trending-scores', 'Update trending scores for jobs', 'active', now(), now()),
('verify-boost-payment', 'Verify job boost payment completion', 'active', now(), now()),
('verify-payment', 'Verify points purchase payment completion', 'active', now(), now()),
('verify-verification-payment', 'Verify company verification payment completion', 'active', now(), now())
ON CONFLICT (name) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = now();

-- Add some sample secrets to demonstrate the functionality
INSERT INTO public.secrets_management (secret_key, description, created_by, used_by_functions) VALUES
('RAZORPAY_KEY_ID', 'Razorpay API Key ID for payment processing', auth.uid(), ARRAY['create-razorpay-order', 'create-boost-order', 'create-verification-order']),
('RAZORPAY_KEY_SECRET', 'Razorpay API Key Secret for payment processing', auth.uid(), ARRAY['razorpay-webhook', 'verify-payment', 'verify-boost-payment', 'verify-verification-payment']),
('OPENAI_API_KEY', 'OpenAI API Key for AI-powered features', auth.uid(), ARRAY[]::text[])
ON CONFLICT (secret_key) DO UPDATE SET
  description = EXCLUDED.description,
  used_by_functions = EXCLUDED.used_by_functions,
  last_updated_at = now();