-- Enable Supabase Realtime for live_sessions table
ALTER TABLE live_sessions REPLICA IDENTITY FULL;

-- Note: The table will be automatically added to supabase_realtime publication
-- No need to manually add it as Supabase handles this automatically
