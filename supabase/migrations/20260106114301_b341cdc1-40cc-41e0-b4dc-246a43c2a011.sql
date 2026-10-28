-- Drop existing function first to change return type
DROP FUNCTION IF EXISTS increment_quota_usage(integer);

-- Add queue_position column for FIFO ordering (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'google_indexing_queue' 
    AND column_name = 'queue_position'
  ) THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN queue_position BIGINT;
  END IF;
END $$;

-- Add scheduled_for column for next day scheduling (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'google_indexing_queue' 
    AND column_name = 'scheduled_for'
  ) THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN scheduled_for TIMESTAMPTZ;
  END IF;
END $$;

-- Add indexnow_submitted column to track IndexNow fallback (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'google_indexing_queue' 
    AND column_name = 'indexnow_submitted'
  ) THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN indexnow_submitted BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create sequence for queue position if not exists
CREATE SEQUENCE IF NOT EXISTS google_indexing_queue_position_seq;

-- Create or replace function to auto-assign queue position
CREATE OR REPLACE FUNCTION assign_queue_position()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.queue_position IS NULL THEN
    NEW.queue_position := nextval('google_indexing_queue_position_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS set_queue_position ON public.google_indexing_queue;

CREATE TRIGGER set_queue_position
  BEFORE INSERT ON public.google_indexing_queue
  FOR EACH ROW
  EXECUTE FUNCTION assign_queue_position();

-- Create function to reset daily quota at PST midnight (8:00 AM UTC)
CREATE OR REPLACE FUNCTION reset_daily_indexing_quota()
RETURNS void AS $$
DECLARE
  today_date DATE;
BEGIN
  today_date := CURRENT_DATE;
  
  INSERT INTO public.indexing_daily_quota (date, quota_used, quota_limit)
  VALUES (today_date, 0, 200)
  ON CONFLICT (date) DO UPDATE 
  SET quota_used = 0, 
      last_reset_at = NOW(),
      updated_at = NOW();
      
  RAISE NOTICE 'Daily quota reset for %', today_date;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create increment_quota_usage function with void return
CREATE OR REPLACE FUNCTION increment_quota_usage(increment_by INTEGER DEFAULT 1)
RETURNS void AS $$
DECLARE
  today_date DATE;
BEGIN
  today_date := CURRENT_DATE;
  
  INSERT INTO public.indexing_daily_quota (date, quota_used, quota_limit, updated_at)
  VALUES (today_date, increment_by, 200, NOW())
  ON CONFLICT (date) DO UPDATE 
  SET quota_used = public.indexing_daily_quota.quota_used + increment_by,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create index for faster FIFO queries
CREATE INDEX IF NOT EXISTS idx_google_indexing_queue_fifo 
  ON public.google_indexing_queue (status, queue_position ASC, created_at ASC)
  WHERE status = 'pending';

-- Create index for scheduled processing
CREATE INDEX IF NOT EXISTS idx_google_indexing_queue_scheduled 
  ON public.google_indexing_queue (scheduled_for, status)
  WHERE status = 'pending';

-- Update existing pending items with queue positions
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.google_indexing_queue
  WHERE queue_position IS NULL
)
UPDATE public.google_indexing_queue q
SET queue_position = n.rn + (SELECT COALESCE(MAX(queue_position), 0) FROM public.google_indexing_queue)
FROM numbered n
WHERE q.id = n.id;