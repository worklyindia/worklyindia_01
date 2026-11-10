-- Create table for daily unique visitors tracking
CREATE TABLE IF NOT EXISTS public.daily_unique_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fingerprint TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  visit_count INTEGER DEFAULT 1,
  country TEXT,
  state TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint on fingerprint and date
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_visitor_per_day 
ON public.daily_unique_visitors(user_fingerprint, visit_date);

-- Enable RLS
ALTER TABLE public.daily_unique_visitors ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert their own visit
CREATE POLICY "Allow insert for visitors"
ON public.daily_unique_visitors
FOR INSERT
WITH CHECK (true);

-- Policy: Allow anyone to read aggregated data (for analytics)
CREATE POLICY "Allow read for analytics"
ON public.daily_unique_visitors
FOR SELECT
USING (true);

-- Policy: Allow anyone to update their own visit
CREATE POLICY "Allow update for visitors"
ON public.daily_unique_visitors
FOR UPDATE
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_visitors_date ON public.daily_unique_visitors(visit_date);
CREATE INDEX IF NOT EXISTS idx_daily_visitors_fingerprint ON public.daily_unique_visitors(user_fingerprint);
CREATE INDEX IF NOT EXISTS idx_daily_visitors_created_at ON public.daily_unique_visitors(created_at);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_unique_visitors;