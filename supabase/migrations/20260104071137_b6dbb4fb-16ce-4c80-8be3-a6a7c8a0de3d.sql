-- Create indexing_daily_quota table for tracking Google API quota
CREATE TABLE IF NOT EXISTS public.indexing_daily_quota (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  quota_used INTEGER NOT NULL DEFAULT 0,
  quota_limit INTEGER NOT NULL DEFAULT 200,
  last_reset_at TIMESTAMP WITH TIME ZONE,
  indexnow_fallback_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- Create index for fast date lookup
CREATE INDEX IF NOT EXISTS idx_indexing_daily_quota_date ON public.indexing_daily_quota(date);

-- Enable RLS
ALTER TABLE public.indexing_daily_quota ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to indexing_daily_quota"
ON public.indexing_daily_quota
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexing_error_logs table for tracking permanent failures
CREATE TABLE IF NOT EXISTS public.indexing_error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  error_code INTEGER,
  error_message TEXT,
  error_type TEXT CHECK (error_type IN ('quota_exceeded', 'invalid_url', 'permission_denied', 'not_found', 'server_error', 'unknown')),
  is_permanent BOOLEAN DEFAULT false,
  fallback_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for URL lookups
CREATE INDEX IF NOT EXISTS idx_indexing_error_logs_url ON public.indexing_error_logs(url);
CREATE INDEX IF NOT EXISTS idx_indexing_error_logs_error_type ON public.indexing_error_logs(error_type);

-- Enable RLS
ALTER TABLE public.indexing_error_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to indexing_error_logs"
ON public.indexing_error_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Add priority column to google_indexing_queue if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_indexing_queue' AND column_name = 'priority') THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN priority INTEGER DEFAULT 5;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_indexing_queue' AND column_name = 'indexnow_submitted') THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN indexnow_submitted BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_indexing_queue' AND column_name = 'page_type') THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN page_type TEXT DEFAULT 'job';
  END IF;
END $$;

-- Create index for priority-based processing
CREATE INDEX IF NOT EXISTS idx_google_indexing_queue_priority ON public.google_indexing_queue(priority DESC, created_at ASC);

-- Create function to get or create today's quota
CREATE OR REPLACE FUNCTION get_or_create_daily_quota()
RETURNS indexing_daily_quota AS $$
DECLARE
  quota_record indexing_daily_quota;
BEGIN
  -- Try to get today's record
  SELECT * INTO quota_record FROM indexing_daily_quota WHERE date = CURRENT_DATE;
  
  -- If not exists, create it
  IF quota_record IS NULL THEN
    INSERT INTO indexing_daily_quota (date, quota_used, quota_limit, last_reset_at)
    VALUES (CURRENT_DATE, 0, 200, now())
    RETURNING * INTO quota_record;
  END IF;
  
  RETURN quota_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment quota usage
CREATE OR REPLACE FUNCTION increment_quota_usage(increment_by INTEGER DEFAULT 1)
RETURNS INTEGER AS $$
DECLARE
  current_usage INTEGER;
BEGIN
  -- Ensure today's record exists and increment
  INSERT INTO indexing_daily_quota (date, quota_used, quota_limit)
  VALUES (CURRENT_DATE, increment_by, 200)
  ON CONFLICT (date) DO UPDATE SET 
    quota_used = indexing_daily_quota.quota_used + increment_by,
    updated_at = now()
  RETURNING quota_used INTO current_usage;
  
  RETURN current_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;