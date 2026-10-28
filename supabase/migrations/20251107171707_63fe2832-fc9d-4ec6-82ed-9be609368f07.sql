-- Create webhook_endpoints table
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  description TEXT,
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_user_id ON public.webhook_endpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_is_active ON public.webhook_endpoints(is_active);

-- Enable RLS
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook_endpoints
CREATE POLICY "Users can view own webhooks"
  ON public.webhook_endpoints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own webhooks"
  ON public.webhook_endpoints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhooks"
  ON public.webhook_endpoints FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhooks"
  ON public.webhook_endpoints FOR DELETE
  USING (auth.uid() = user_id);

-- Create webhook_deliveries table
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('delivered', 'failed')),
  response_status INTEGER,
  error_message TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON public.webhook_deliveries(created_at DESC);

-- Enable RLS
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policy for webhook_deliveries
CREATE POLICY "Users can view own webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_endpoints 
      WHERE webhook_endpoints.id = webhook_deliveries.webhook_id 
      AND webhook_endpoints.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at on webhook_endpoints
CREATE OR REPLACE FUNCTION public.update_webhook_endpoints_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_webhook_endpoints_updated_at
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webhook_endpoints_updated_at();