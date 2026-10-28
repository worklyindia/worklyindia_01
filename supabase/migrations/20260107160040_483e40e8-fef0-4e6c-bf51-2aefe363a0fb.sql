-- ============================================
-- INDEXING STATUS TRACKING SYSTEM
-- Real-time Google & Bing status with 4 stages:
-- Queued → Scheduled → Submitted → Public
-- ============================================

-- Add new columns to google_indexing_queue for detailed tracking
ALTER TABLE public.google_indexing_queue 
ADD COLUMN IF NOT EXISTS google_status text DEFAULT 'queued',
ADD COLUMN IF NOT EXISTS google_queued_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS google_scheduled_at timestamptz,
ADD COLUMN IF NOT EXISTS google_submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS google_public_at timestamptz,
ADD COLUMN IF NOT EXISTS is_google_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS google_verification_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS google_last_verified_at timestamptz;

-- Create Bing indexing queue table
CREATE TABLE IF NOT EXISTS public.bing_indexing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  job_id uuid,
  page_type text DEFAULT 'job',
  
  -- Status tracking (Queued → Scheduled → Submitted → Public)
  bing_status text DEFAULT 'queued',
  bing_queued_at timestamptz DEFAULT now(),
  bing_scheduled_at timestamptz,
  bing_submitted_at timestamptz,
  bing_public_at timestamptz,
  is_bing_public boolean DEFAULT false,
  
  -- IndexNow tracking
  indexnow_submitted boolean DEFAULT false,
  indexnow_submitted_at timestamptz,
  indexnow_response jsonb,
  
  -- Bing Webmaster API tracking
  bing_api_submitted boolean DEFAULT false,
  bing_api_submitted_at timestamptz,
  bing_api_response jsonb,
  
  -- Verification
  verification_attempts integer DEFAULT 0,
  last_verified_at timestamptz,
  
  -- Error handling
  error_message text,
  retry_count integer DEFAULT 0,
  
  -- Metadata
  priority integer DEFAULT 5,
  source text DEFAULT 'auto',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT bing_indexing_queue_url_unique UNIQUE(url)
);

-- Create unified indexing status view for jobs
CREATE TABLE IF NOT EXISTS public.job_indexing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  url text NOT NULL,
  
  -- Google Status
  google_status text DEFAULT 'queued',
  google_queued_at timestamptz,
  google_scheduled_at timestamptz,
  google_submitted_at timestamptz,
  google_public_at timestamptz,
  is_google_public boolean DEFAULT false,
  google_last_checked_at timestamptz,
  google_error text,
  
  -- Bing Status
  bing_status text DEFAULT 'queued',
  bing_queued_at timestamptz,
  bing_scheduled_at timestamptz,
  bing_submitted_at timestamptz,
  bing_public_at timestamptz,
  is_bing_public boolean DEFAULT false,
  bing_last_checked_at timestamptz,
  bing_error text,
  
  -- Combined status
  overall_status text GENERATED ALWAYS AS (
    CASE 
      WHEN is_google_public AND is_bing_public THEN 'fully_indexed'
      WHEN is_google_public OR is_bing_public THEN 'partially_indexed'
      WHEN google_status = 'submitted' OR bing_status = 'submitted' THEN 'submitted'
      WHEN google_status = 'scheduled' OR bing_status = 'scheduled' THEN 'scheduled'
      ELSE 'queued'
    END
  ) STORED,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT job_indexing_status_job_unique UNIQUE(job_id),
  CONSTRAINT job_indexing_status_url_unique UNIQUE(url)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bing_indexing_queue_status ON public.bing_indexing_queue(bing_status);
CREATE INDEX IF NOT EXISTS idx_bing_indexing_queue_url ON public.bing_indexing_queue(url);
CREATE INDEX IF NOT EXISTS idx_bing_indexing_queue_job_id ON public.bing_indexing_queue(job_id);
CREATE INDEX IF NOT EXISTS idx_job_indexing_status_job_id ON public.job_indexing_status(job_id);
CREATE INDEX IF NOT EXISTS idx_job_indexing_status_overall ON public.job_indexing_status(overall_status);
CREATE INDEX IF NOT EXISTS idx_google_indexing_queue_google_status ON public.google_indexing_queue(google_status);

-- Enable RLS
ALTER TABLE public.bing_indexing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_indexing_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only access
CREATE POLICY "Admin full access to bing_indexing_queue"
ON public.bing_indexing_queue
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admin full access to job_indexing_status"
ON public.job_indexing_status
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Allow service role full access
CREATE POLICY "Service role access to bing_indexing_queue"
ON public.bing_indexing_queue
FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role access to job_indexing_status"
ON public.job_indexing_status
FOR ALL
USING (auth.role() = 'service_role');

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_indexing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bing_indexing_queue_updated_at
  BEFORE UPDATE ON public.bing_indexing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_indexing_updated_at();

CREATE TRIGGER update_job_indexing_status_updated_at
  BEFORE UPDATE ON public.job_indexing_status
  FOR EACH ROW
  EXECUTE FUNCTION update_indexing_updated_at();

-- Function to sync indexing status from queues
CREATE OR REPLACE FUNCTION sync_job_indexing_status()
RETURNS void AS $$
BEGIN
  -- Upsert from google_indexing_queue
  INSERT INTO public.job_indexing_status (job_id, url, google_status, google_queued_at, google_scheduled_at, google_submitted_at, google_public_at, is_google_public, google_last_checked_at)
  SELECT 
    g.job_id,
    g.url,
    COALESCE(g.google_status, 'queued'),
    g.google_queued_at,
    g.google_scheduled_at,
    g.google_submitted_at,
    g.google_public_at,
    COALESCE(g.is_google_public, false),
    g.google_last_verified_at
  FROM public.google_indexing_queue g
  WHERE g.job_id IS NOT NULL
  ON CONFLICT (job_id) DO UPDATE SET
    google_status = EXCLUDED.google_status,
    google_queued_at = EXCLUDED.google_queued_at,
    google_scheduled_at = EXCLUDED.google_scheduled_at,
    google_submitted_at = EXCLUDED.google_submitted_at,
    google_public_at = EXCLUDED.google_public_at,
    is_google_public = EXCLUDED.is_google_public,
    google_last_checked_at = EXCLUDED.google_last_checked_at,
    updated_at = now();

  -- Update from bing_indexing_queue
  UPDATE public.job_indexing_status jis
  SET 
    bing_status = b.bing_status,
    bing_queued_at = b.bing_queued_at,
    bing_scheduled_at = b.bing_scheduled_at,
    bing_submitted_at = b.bing_submitted_at,
    bing_public_at = b.bing_public_at,
    is_bing_public = b.is_bing_public,
    bing_last_checked_at = b.last_verified_at,
    updated_at = now()
  FROM public.bing_indexing_queue b
  WHERE jis.job_id = b.job_id AND b.job_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;