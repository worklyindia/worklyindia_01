-- Create API Request Logs table for tracking all API calls
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  request_params JSONB DEFAULT '{}'::jsonb,
  response_size_bytes INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own API request logs
CREATE POLICY "Users can view their own API request logs"
ON public.api_request_logs
FOR SELECT
USING (
  api_key_id IN (
    SELECT id FROM public.api_keys WHERE user_id = auth.uid()
  )
);

-- Policy: Service role can insert logs
CREATE POLICY "Service role can insert API request logs"
ON public.api_request_logs
FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_request_logs_api_key_id 
ON public.api_request_logs(api_key_id);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_at 
ON public.api_request_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_endpoint 
ON public.api_request_logs(endpoint);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_status_code 
ON public.api_request_logs(status_code);

-- Create view for API analytics
CREATE OR REPLACE VIEW public.api_analytics AS
SELECT 
  ak.user_id,
  ak.key_name,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE arl.status_code >= 200 AND arl.status_code < 300) as success_count,
  COUNT(*) FILTER (WHERE arl.status_code >= 400) as error_count,
  AVG(arl.response_time_ms) as avg_response_time,
  MAX(arl.created_at) as last_request_at,
  DATE_TRUNC('hour', arl.created_at) as time_bucket
FROM public.api_request_logs arl
LEFT JOIN public.api_keys ak ON arl.api_key_id = ak.id
GROUP BY ak.user_id, ak.key_name, DATE_TRUNC('hour', arl.created_at);

COMMENT ON TABLE public.api_request_logs IS 'Logs all API requests for analytics and monitoring';
COMMENT ON VIEW public.api_analytics IS 'Aggregated API analytics per user and time bucket';
