-- ================================================
-- GOOGLE INDEXING SYSTEM - COMPLETE OVERHAUL
-- ================================================

-- 1. Create indexing_daily_slots table for tracking daily capacity
CREATE TABLE IF NOT EXISTS public.indexing_daily_slots (
  date DATE PRIMARY KEY,
  total_slots INTEGER DEFAULT 200 NOT NULL,
  used_slots INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.indexing_daily_slots ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to indexing_daily_slots"
ON public.indexing_daily_slots
FOR ALL
USING (true)
WITH CHECK (true);

-- 2. Add new columns to google_indexing_queue if they don't exist
DO $$ 
BEGIN
  -- Add daily_position column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_indexing_queue' AND column_name = 'daily_position') THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN daily_position INTEGER;
  END IF;

  -- Add original_posted_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_indexing_queue' AND column_name = 'original_posted_at') THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN original_posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add queue_date column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_indexing_queue' AND column_name = 'queue_date') THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN queue_date DATE;
  END IF;

  -- Add exact_scheduled_time column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_indexing_queue' AND column_name = 'exact_scheduled_time') THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN exact_scheduled_time TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add estimated_index_date column for user display
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_indexing_queue' AND column_name = 'estimated_index_date') THEN
    ALTER TABLE public.google_indexing_queue ADD COLUMN estimated_index_date DATE;
  END IF;
END $$;

-- 3. Add index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_google_indexing_queue_scheduled 
ON public.google_indexing_queue(exact_scheduled_time, daily_position) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_google_indexing_queue_date 
ON public.google_indexing_queue(queue_date) 
WHERE status = 'pending';

-- 4. Create function to get or create daily slot record
CREATE OR REPLACE FUNCTION public.get_or_create_daily_slots(target_date DATE)
RETURNS public.indexing_daily_slots AS $$
DECLARE
  slot_record public.indexing_daily_slots;
BEGIN
  -- Try to get existing record
  SELECT * INTO slot_record FROM public.indexing_daily_slots WHERE date = target_date;
  
  -- If not found, create it
  IF NOT FOUND THEN
    INSERT INTO public.indexing_daily_slots (date, total_slots, used_slots)
    VALUES (target_date, 200, 0)
    RETURNING * INTO slot_record;
  END IF;
  
  RETURN slot_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create function to find next available slot date
CREATE OR REPLACE FUNCTION public.find_next_available_slot_date(
  start_date DATE DEFAULT CURRENT_DATE,
  max_days_ahead INTEGER DEFAULT 30
)
RETURNS TABLE(
  available_date DATE,
  remaining_slots INTEGER,
  next_position INTEGER
) AS $$
DECLARE
  check_date DATE := start_date;
  slot_record public.indexing_daily_slots;
  days_checked INTEGER := 0;
BEGIN
  WHILE days_checked < max_days_ahead LOOP
    -- Get or create slot record for this date
    slot_record := public.get_or_create_daily_slots(check_date);
    
    -- Check if slots available
    IF slot_record.used_slots < slot_record.total_slots THEN
      available_date := check_date;
      remaining_slots := slot_record.total_slots - slot_record.used_slots;
      next_position := slot_record.used_slots + 1;
      RETURN NEXT;
      RETURN;
    END IF;
    
    -- Move to next day
    check_date := check_date + INTERVAL '1 day';
    days_checked := days_checked + 1;
  END LOOP;
  
  -- If no slot found within max_days_ahead, return the next day after max
  available_date := start_date + max_days_ahead;
  remaining_slots := 200;
  next_position := 1;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create main function to assign job to queue
CREATE OR REPLACE FUNCTION public.assign_job_to_indexing_queue(
  p_url TEXT,
  p_page_type TEXT DEFAULT 'job',
  p_action TEXT DEFAULT 'URL_UPDATED',
  p_priority INTEGER DEFAULT 10,
  p_job_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  queue_id UUID,
  assigned_date DATE,
  queue_position INTEGER,
  exact_scheduled_time TIMESTAMP WITH TIME ZONE,
  days_pending INTEGER,
  message TEXT
) AS $$
DECLARE
  v_slot_info RECORD;
  v_queue_id UUID;
  v_posted_time TIME := CURRENT_TIME;
  v_scheduled_time TIMESTAMP WITH TIME ZONE;
  v_days_pending INTEGER;
BEGIN
  -- Find next available slot
  SELECT * INTO v_slot_info FROM public.find_next_available_slot_date(CURRENT_DATE, 30);
  
  -- Calculate exact scheduled time (same time as posting, but on the assigned date)
  v_scheduled_time := (v_slot_info.available_date + v_posted_time)::TIMESTAMP WITH TIME ZONE;
  
  -- If assigned date is today, use current time
  IF v_slot_info.available_date = CURRENT_DATE THEN
    v_scheduled_time := NOW();
  END IF;
  
  -- Calculate days pending
  v_days_pending := v_slot_info.available_date - CURRENT_DATE;
  
  -- Insert into queue
  INSERT INTO public.google_indexing_queue (
    url,
    action,
    status,
    priority,
    page_type,
    queue_date,
    queue_position,
    daily_position,
    original_posted_at,
    exact_scheduled_time,
    estimated_index_date,
    scheduled_for,
    created_at
  ) VALUES (
    p_url,
    p_action,
    'pending',
    p_priority,
    p_page_type,
    v_slot_info.available_date,
    v_slot_info.next_position,
    v_slot_info.next_position,
    NOW(),
    v_scheduled_time,
    v_slot_info.available_date,
    v_scheduled_time,
    NOW()
  )
  ON CONFLICT (url) DO UPDATE SET
    action = EXCLUDED.action,
    status = 'pending',
    priority = EXCLUDED.priority,
    queue_date = EXCLUDED.queue_date,
    queue_position = EXCLUDED.queue_position,
    daily_position = EXCLUDED.daily_position,
    exact_scheduled_time = EXCLUDED.exact_scheduled_time,
    estimated_index_date = EXCLUDED.estimated_index_date,
    scheduled_for = EXCLUDED.scheduled_for,
    updated_at = NOW()
  RETURNING id INTO v_queue_id;
  
  -- Update used slots count
  UPDATE public.indexing_daily_slots 
  SET used_slots = used_slots + 1, updated_at = NOW()
  WHERE date = v_slot_info.available_date;
  
  -- If no rows updated, it means we need to create the slot record
  IF NOT FOUND THEN
    INSERT INTO public.indexing_daily_slots (date, total_slots, used_slots)
    VALUES (v_slot_info.available_date, 200, 1)
    ON CONFLICT (date) DO UPDATE SET used_slots = indexing_daily_slots.used_slots + 1;
  END IF;
  
  -- Return result
  queue_id := v_queue_id;
  assigned_date := v_slot_info.available_date;
  queue_position := v_slot_info.next_position;
  exact_scheduled_time := v_scheduled_time;
  days_pending := v_days_pending;
  
  IF v_days_pending = 0 THEN
    message := 'Job will be indexed today';
  ELSIF v_days_pending = 1 THEN
    message := 'Job will be indexed tomorrow';
  ELSE
    message := 'Job will be indexed in ' || v_days_pending || ' days';
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Create function to release a slot (when job is cancelled or removed)
CREATE OR REPLACE FUNCTION public.release_indexing_slot(
  p_queue_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_queue_date DATE;
BEGIN
  -- Get the queue date for this item
  SELECT queue_date INTO v_queue_date 
  FROM public.google_indexing_queue 
  WHERE id = p_queue_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Decrease used slots
  UPDATE public.indexing_daily_slots 
  SET used_slots = GREATEST(0, used_slots - 1), updated_at = NOW()
  WHERE date = v_queue_date;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Create function to get next job to process (1 by 1)
CREATE OR REPLACE FUNCTION public.get_next_indexing_job()
RETURNS TABLE(
  id UUID,
  url TEXT,
  action TEXT,
  priority INTEGER,
  page_type TEXT,
  retry_count INTEGER,
  queue_date DATE,
  daily_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.url,
    q.action,
    q.priority,
    q.page_type,
    q.retry_count,
    q.queue_date,
    q.daily_position
  FROM public.google_indexing_queue q
  WHERE q.status = 'pending'
    AND (q.exact_scheduled_time IS NULL OR q.exact_scheduled_time <= NOW())
  ORDER BY 
    q.exact_scheduled_time ASC NULLS LAST,
    q.queue_date ASC NULLS LAST,
    q.daily_position ASC NULLS LAST,
    q.priority DESC,
    q.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Create function to check today's quota status
CREATE OR REPLACE FUNCTION public.get_today_indexing_quota()
RETURNS TABLE(
  date DATE,
  total_limit INTEGER,
  used_count INTEGER,
  remaining_count INTEGER,
  is_quota_available BOOLEAN
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_quota RECORD;
BEGIN
  -- Get or create today's quota record
  SELECT * INTO v_quota FROM public.indexing_daily_quota WHERE indexing_daily_quota.date = v_today;
  
  IF NOT FOUND THEN
    INSERT INTO public.indexing_daily_quota (date, quota_used, quota_limit)
    VALUES (v_today, 0, 200)
    RETURNING * INTO v_quota;
  END IF;
  
  date := v_today;
  total_limit := v_quota.quota_limit;
  used_count := v_quota.quota_used;
  remaining_count := v_quota.quota_limit - v_quota.quota_used;
  is_quota_available := v_quota.quota_used < v_quota.quota_limit;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_indexing_daily_slots_date 
ON public.indexing_daily_slots(date);

CREATE INDEX IF NOT EXISTS idx_google_indexing_queue_status_scheduled 
ON public.google_indexing_queue(status, exact_scheduled_time);

-- 11. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_or_create_daily_slots(DATE) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.find_next_available_slot_date(DATE, INTEGER) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assign_job_to_indexing_queue(TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.release_indexing_slot(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_indexing_job() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_today_indexing_quota() TO authenticated, anon, service_role;