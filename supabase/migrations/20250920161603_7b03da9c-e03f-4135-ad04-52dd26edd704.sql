-- Complete the realtime setup for jobs table (ignoring if already exists)
-- Ensure proper replication identity for realtime
DO $$
BEGIN
  -- Only add to publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
END
$$;

-- Ensure proper replication identity for realtime updates
ALTER TABLE public.jobs REPLICA IDENTITY FULL;